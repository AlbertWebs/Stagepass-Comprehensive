<?php

declare(strict_types=1);

/**
 * Generate Laravel migration + seeders from SQLite snapshot.
 *
 * Usage:
 *   php scripts/generate_sqlite_snapshot.php
 */

$root = dirname(__DIR__);
$sqlitePath = $root . '/database/database.sqlite';
$migrationsPath = $root . '/database/migrations';
$seedersPath = $root . '/database/seeders';
$reportPath = $root . '/database/sqlite_mysql_schema_report.md';

if (!is_file($sqlitePath)) {
    fwrite(STDERR, "SQLite database not found: {$sqlitePath}\n");
    exit(1);
}

$pdo = new PDO('sqlite:' . $sqlitePath);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

/** @return array<int, string> */
function sqliteTables(PDO $pdo): array
{
    $stmt = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    $tables = array_map(static fn(array $r): string => (string) $r['name'], $stmt->fetchAll(PDO::FETCH_ASSOC));
    $exclude = ['migrations'];
    return array_values(array_filter($tables, static fn(string $t): bool => !in_array($t, $exclude, true)));
}

/** @return array<int, array<string, mixed>> */
function tableColumns(PDO $pdo, string $table): array
{
    return $pdo->query("PRAGMA table_info(\"{$table}\")")->fetchAll(PDO::FETCH_ASSOC);
}

/** @return array<int, array<string, mixed>> */
function tableForeignKeys(PDO $pdo, string $table): array
{
    return $pdo->query("PRAGMA foreign_key_list(\"{$table}\")")->fetchAll(PDO::FETCH_ASSOC);
}

/** @return array<int, array<string, mixed>> */
function tableIndexes(PDO $pdo, string $table): array
{
    return $pdo->query("PRAGMA index_list(\"{$table}\")")->fetchAll(PDO::FETCH_ASSOC);
}

/** @return array<int, string> */
function indexColumns(PDO $pdo, string $indexName): array
{
    $rows = $pdo->query("PRAGMA index_info(\"{$indexName}\")")->fetchAll(PDO::FETCH_ASSOC);
    return array_map(static fn(array $r): string => (string) $r['name'], $rows);
}

function studly(string $value): string
{
    $value = preg_replace('/[^a-zA-Z0-9]+/', ' ', $value) ?? $value;
    return str_replace(' ', '', ucwords(strtolower(trim($value))));
}

function migrationColumn(array $col, bool $isAutoincrement, bool $allowInlinePrimary = true): array
{
    $name = (string) $col['name'];
    $type = strtoupper((string) ($col['type'] ?? 'TEXT'));
    $notnull = (int) ($col['notnull'] ?? 0) === 1;
    $default = $col['dflt_value'];
    $isPk = (int) ($col['pk'] ?? 0) > 0;

    if ($isPk && $isAutoincrement && $name === 'id') {
        return ['line' => "\$table->bigIncrements('id');", 'special' => true];
    }

    if (preg_match('/VARCHAR\((\d+)\)/i', $type, $m)) {
        $line = "\$table->string('{$name}', {$m[1]})";
    } elseif (str_contains($type, 'CHAR')) {
        $line = "\$table->string('{$name}')";
    } elseif (str_contains($type, 'TEXT')) {
        $line = "\$table->text('{$name}')";
    } elseif (str_contains($type, 'BIGINT')) {
        $line = "\$table->bigInteger('{$name}')";
    } elseif (str_contains($type, 'INT')) {
        $line = "\$table->integer('{$name}')";
    } elseif (preg_match('/DECIMAL\((\d+),\s*(\d+)\)/i', $type, $m)) {
        $line = "\$table->decimal('{$name}', {$m[1]}, {$m[2]})";
    } elseif (str_contains($type, 'NUMERIC')) {
        $line = "\$table->decimal('{$name}', 14, 4)";
    } elseif (str_contains($type, 'REAL') || str_contains($type, 'DOUBLE') || str_contains($type, 'FLOAT')) {
        $line = "\$table->double('{$name}')";
    } elseif (str_contains($type, 'BOOL') || str_contains($type, 'TINYINT(1)')) {
        $line = "\$table->boolean('{$name}')";
    } elseif (str_contains($type, 'DATE') && !str_contains($type, 'TIME')) {
        $line = "\$table->date('{$name}')";
    } elseif (str_contains($type, 'DATETIME') || str_contains($type, 'TIMESTAMP')) {
        $line = "\$table->timestamp('{$name}')";
    } elseif (str_contains($type, 'JSON')) {
        $line = "\$table->json('{$name}')";
    } elseif (str_contains($type, 'BLOB')) {
        $line = "\$table->binary('{$name}')";
    } else {
        $line = "\$table->text('{$name}')";
    }

    if (!$notnull) {
        $line .= '->nullable()';
    }
    if ($isPk && !$isAutoincrement && $allowInlinePrimary) {
        $line .= '->primary()';
    }
    if ($default !== null) {
        $d = trim((string) $default, "'\"");
        if (strtoupper($d) === 'CURRENT_TIMESTAMP') {
            $line .= '->useCurrent()';
        } elseif (is_numeric($d)) {
            $line .= "->default({$d})";
        } elseif (strtolower($d) === 'null') {
            // keep nullable only
        } else {
            $line .= "->default(" . var_export($d, true) . ')';
        }
    }

    return ['line' => $line . ';', 'special' => false];
}

/** @return array<int, string> */
function topoSort(array $tables, array $deps): array
{
    $inDegree = array_fill_keys($tables, 0);
    $graph = [];
    foreach ($tables as $t) {
        $graph[$t] = [];
    }
    foreach ($deps as $table => $parents) {
        foreach ($parents as $p) {
            if (!isset($inDegree[$p])) {
                continue;
            }
            $graph[$p][] = $table;
            $inDegree[$table] += 1;
        }
    }
    $queue = [];
    foreach ($inDegree as $t => $deg) {
        if ($deg === 0) {
            $queue[] = $t;
        }
    }
    $order = [];
    while ($queue) {
        $t = array_shift($queue);
        $order[] = $t;
        foreach ($graph[$t] as $child) {
            $inDegree[$child] -= 1;
            if ($inDegree[$child] === 0) {
                $queue[] = $child;
            }
        }
    }
    if (count($order) !== count($tables)) {
        return $tables;
    }
    return $order;
}

$tables = sqliteTables($pdo);
$tableMeta = [];
$deps = [];
$report = [];

foreach ($tables as $table) {
    $cols = tableColumns($pdo, $table);
    $fks = tableForeignKeys($pdo, $table);
    $idx = tableIndexes($pdo, $table);
    $sql = (string) ($pdo->query("SELECT sql FROM sqlite_master WHERE type='table' AND name='{$table}'")->fetch(PDO::FETCH_ASSOC)['sql'] ?? '');
    $auto = str_contains(strtoupper($sql), 'AUTOINCREMENT');
    $deps[$table] = [];
    foreach ($fks as $fk) {
        $deps[$table][] = (string) $fk['table'];
    }
    $tableMeta[$table] = compact('cols', 'fks', 'idx', 'auto');
    $report[] = "### {$table}";
    $report[] = "- Columns: " . count($cols);
    $report[] = "- Foreign keys: " . count($fks);
    $report[] = "- Indexes: " . count($idx);
    $report[] = '';
}

$orderedTables = topoSort($tables, $deps);

// Remove older generated snapshot migration files only.
foreach (glob($migrationsPath . '/*_sqlite_snapshot_schema.php') ?: [] as $old) {
    @unlink($old);
}
$migrationFile = $migrationsPath . '/2026_04_15_150000_sqlite_snapshot_schema.php';

$migration = [];
$migration[] = '<?php';
$migration[] = '';
$migration[] = 'use Illuminate\Database\Migrations\Migration;';
$migration[] = 'use Illuminate\Database\Schema\Blueprint;';
$migration[] = 'use Illuminate\Support\Facades\Schema;';
$migration[] = '';
$migration[] = 'return new class extends Migration {';
$migration[] = '    public function up(): void';
$migration[] = '    {';
$migration[] = '        Schema::disableForeignKeyConstraints();';

foreach ($orderedTables as $table) {
    $meta = $tableMeta[$table];
    $cols = $meta['cols'];
    $fks = $meta['fks'];
    $idx = $meta['idx'];
    $auto = (bool) $meta['auto'];

    $migration[] = "        Schema::dropIfExists('{$table}');";
    $migration[] = "        Schema::create('{$table}', function (Blueprint \$table) {";

    $pkCols = array_values(array_map(
        static fn(array $c): string => (string) $c['name'],
        array_filter($cols, static fn(array $c): bool => (int) $c['pk'] > 0)
    ));
    $compositePk = count($pkCols) > 1;

    $hasCreatedAt = false;
    $hasUpdatedAt = false;
    $hasDeletedAt = false;

    foreach ($cols as $col) {
        $name = (string) $col['name'];
        if ($name === 'created_at') {
            $hasCreatedAt = true;
            continue;
        }
        if ($name === 'updated_at') {
            $hasUpdatedAt = true;
            continue;
        }
        if ($name === 'deleted_at') {
            $hasDeletedAt = true;
            continue;
        }
        $mapped = migrationColumn($col, $auto, !$compositePk);
        $migration[] = '            ' . $mapped['line'];
    }

    if ($compositePk) {
        $pkExport = '[' . implode(', ', array_map(static fn(string $c): string => "'" . $c . "'", $pkCols)) . ']';
        $migration[] = "            \$table->primary({$pkExport});";
    }

    if ($hasCreatedAt && $hasUpdatedAt) {
        $migration[] = '            $table->timestamps();';
    } elseif ($hasCreatedAt) {
        $migration[] = "            \$table->timestamp('created_at')->nullable();";
    } elseif ($hasUpdatedAt) {
        $migration[] = "            \$table->timestamp('updated_at')->nullable();";
    }

    if ($hasDeletedAt) {
        $migration[] = '            $table->softDeletes();';
    }

    if ($table === 'users') {
        $colNames = array_map(static fn(array $c): string => (string) $c['name'], $cols);
        if (! in_array('address', $colNames, true)) {
            $migration[] = "            \$table->text('address')->nullable();";
        }
        if (! in_array('emergency_contact', $colNames, true)) {
            $migration[] = "            \$table->string('emergency_contact', 255)->nullable();";
        }
    }

    // Indexes (excluding auto PK index and sqlite internal indexes)
    foreach ($idx as $index) {
        $name = (string) $index['name'];
        if (str_starts_with($name, 'sqlite_autoindex')) {
            continue;
        }
        $columns = indexColumns($pdo, $name);
        if (!$columns) {
            continue;
        }
        $colsPhp = '[' . implode(', ', array_map(static fn(string $c): string => "'" . $c . "'", $columns)) . ']';
        $isUnique = (int) ($index['unique'] ?? 0) === 1;
        if ($isUnique) {
            $migration[] = "            \$table->unique({$colsPhp}, '{$name}');";
        } else {
            $migration[] = "            \$table->index({$colsPhp}, '{$name}');";
        }
    }

    foreach ($fks as $fk) {
        $col = (string) $fk['from'];
        $refTable = (string) $fk['table'];
        $refCol = (string) $fk['to'];
        $onDelete = strtoupper((string) ($fk['on_delete'] ?? 'NO ACTION'));
        $onUpdate = strtoupper((string) ($fk['on_update'] ?? 'NO ACTION'));
        $line = "            \$table->foreign('{$col}')->references('{$refCol}')->on('{$refTable}')";
        if ($onDelete !== 'NO ACTION' && $onDelete !== 'RESTRICT') {
            $line .= "->onDelete('" . strtolower($onDelete) . "')";
        }
        if ($onUpdate !== 'NO ACTION' && $onUpdate !== 'RESTRICT') {
            $line .= "->onUpdate('" . strtolower($onUpdate) . "')";
        }
        $line .= ';';
        $migration[] = $line;
    }

    $migration[] = '        });';
}

$migration[] = '        Schema::enableForeignKeyConstraints();';
$migration[] = '    }';
$migration[] = '';
$migration[] = '    public function down(): void';
$migration[] = '    {';
$migration[] = '        Schema::disableForeignKeyConstraints();';
foreach (array_reverse($orderedTables) as $table) {
    $migration[] = "        Schema::dropIfExists('{$table}');";
}
$migration[] = '        Schema::enableForeignKeyConstraints();';
$migration[] = '    }';
$migration[] = '};';
$migration[] = '';

file_put_contents($migrationFile, implode("\n", $migration));

// Remove previous generated table seeders.
foreach (glob($seedersPath . '/*TableSeeder.php') ?: [] as $old) {
    @unlink($old);
}

$seederClasses = [];
foreach ($orderedTables as $table) {
    $class = studly($table) . 'TableSeeder';
    $seederClasses[] = $class;
    $rows = $pdo->query("SELECT * FROM \"{$table}\"")->fetchAll(PDO::FETCH_ASSOC);
    if ($table === 'users') {
        foreach ($rows as $i => $_) {
            if (! array_key_exists('address', $rows[$i])) {
                $rows[$i]['address'] = null;
            }
            if (! array_key_exists('emergency_contact', $rows[$i])) {
                $rows[$i]['emergency_contact'] = null;
            }
        }
    }
    $cols = tableColumns($pdo, $table);
    $pkCols = array_values(array_map(static fn(array $c): string => (string) $c['name'], array_filter($cols, static fn(array $c): bool => (int) $c['pk'] > 0)));
    $seederFile = $seedersPath . '/' . $class . '.php';

    $chunks = array_chunk($rows, 250);
    $body = [];
    $body[] = '<?php';
    $body[] = '';
    $body[] = 'namespace Database\Seeders;';
    $body[] = '';
    $body[] = 'use Illuminate\Database\Seeder;';
    $body[] = 'use Illuminate\Support\Facades\DB;';
    $body[] = '';
    $body[] = "class {$class} extends Seeder";
    $body[] = '{';
    $body[] = '    public function run(): void';
    $body[] = '    {';
    if (!$rows) {
        $body[] = '        // No rows in snapshot.';
        $body[] = '        return;';
    } else {
        foreach ($chunks as $chunk) {
            $export = var_export($chunk, true);
            $export = preg_replace("/^([ ]+)/m", '        $1', $export ?? '') ?? $export;
            if ($pkCols) {
                $pkExport = '[' . implode(', ', array_map(static fn(string $c): string => "'" . $c . "'", $pkCols)) . ']';
                $body[] = "        DB::table('{$table}')->upsert({$export}, {$pkExport});";
            } else {
                $body[] = "        DB::table('{$table}')->insertOrIgnore({$export});";
            }
        }
    }
    $body[] = '    }';
    $body[] = '}';
    $body[] = '';
    file_put_contents($seederFile, implode("\n", $body));
}

$dbSeeder = [];
$dbSeeder[] = '<?php';
$dbSeeder[] = '';
$dbSeeder[] = 'namespace Database\Seeders;';
$dbSeeder[] = '';
$dbSeeder[] = 'use Illuminate\Database\Seeder;';
$dbSeeder[] = 'use Illuminate\Support\Facades\Schema;';
$dbSeeder[] = '';
$dbSeeder[] = 'class DatabaseSeeder extends Seeder';
$dbSeeder[] = '{';
$dbSeeder[] = '    public function run(): void';
$dbSeeder[] = '    {';
$dbSeeder[] = '        Schema::disableForeignKeyConstraints();';
$dbSeeder[] = '        $this->call([';
foreach ($seederClasses as $class) {
    $dbSeeder[] = "            {$class}::class,";
}
$dbSeeder[] = '        ]);';
$dbSeeder[] = '        Schema::enableForeignKeyConstraints();';
$dbSeeder[] = '    }';
$dbSeeder[] = '}';
$dbSeeder[] = '';
file_put_contents($seedersPath . '/DatabaseSeeder.php', implode("\n", $dbSeeder));

$reportLines = [];
$reportLines[] = '# SQLite -> MySQL Schema Report';
$reportLines[] = '';
$reportLines[] = '- Source: `database/database.sqlite`';
$reportLines[] = '- Generated migration: `database/migrations/2026_04_15_150000_sqlite_snapshot_schema.php`';
$reportLines[] = '- Generated seeders: `database/seeders/*TableSeeder.php`';
$reportLines[] = '';
$reportLines[] = '## Compatibility Notes';
$reportLines[] = '';
$reportLines[] = '- SQLite affinities were mapped to Laravel column methods for MySQL compatibility.';
$reportLines[] = '- Integer primary keys with AUTOINCREMENT were mapped to `bigIncrements`.';
$reportLines[] = '- `created_at` + `updated_at` were normalized to `timestamps()` where both exist.';
$reportLines[] = '- `deleted_at` columns were normalized to `softDeletes()` where present.';
$reportLines[] = '- Seeders use `upsert` on primary key columns (idempotent) and `insertOrIgnore` when PK is absent.';
$reportLines[] = '';
$reportLines[] = '## Discovered Tables';
$reportLines[] = '';
$reportLines = array_merge($reportLines, $report);
file_put_contents($reportPath, implode("\n", $reportLines));

echo "Generated migration, seeders, and report successfully.\n";
echo "Migration: {$migrationFile}\n";
echo "Report: {$reportPath}\n";
