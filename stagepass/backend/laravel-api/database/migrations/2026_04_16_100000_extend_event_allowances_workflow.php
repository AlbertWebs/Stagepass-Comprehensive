<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        // Partial runs or DBs created without the custom index name: drop the old 4-column
        // composite unique only when it still exists (either `event_allowances_dedupe_key` or
        // Laravel’s default …_event_id_crew_id_…_unique).
        $this->dropLegacyCompositeDedupeUniqueIfExists();

        Schema::table('event_allowances', function (Blueprint $table) {
            if (! Schema::hasColumn('event_allowances', 'source')) {
                $table->string('source', 20)->default('manual');
            }
            if (! Schema::hasColumn('event_allowances', 'attachment_path')) {
                $table->string('attachment_path', 500)->nullable();
            }
            if (! Schema::hasColumn('event_allowances', 'rejection_comment')) {
                $table->text('rejection_comment')->nullable();
            }
            if (! Schema::hasColumn('event_allowances', 'approval_comment')) {
                $table->text('approval_comment')->nullable();
            }
            if (! Schema::hasColumn('event_allowances', 'meal_slot')) {
                $table->string('meal_slot', 20)->nullable();
            }
            if (! Schema::hasColumn('event_allowances', 'meal_grant_date')) {
                $table->date('meal_grant_date')->nullable();
            }
            if (! Schema::hasColumn('event_allowances', 'dedupe_key')) {
                $table->string('dedupe_key', 96)->nullable();
            }
            if (! Schema::hasColumn('event_allowances', 'rejected_by')) {
                $table->foreignId('rejected_by')->nullable()->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('event_allowances', 'rejected_at')) {
                $table->timestamp('rejected_at')->nullable();
            }
        });

        if (! $this->hasUniqueIndexOnColumn('event_allowances', 'dedupe_key')) {
            Schema::table('event_allowances', function (Blueprint $table) {
                $table->unique('dedupe_key');
            });
        }

        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE event_allowances MODIFY COLUMN status ENUM('pending', 'approved', 'rejected', 'paid') NOT NULL DEFAULT 'pending'");
        }
    }

    /**
     * The original migration named this index `event_allowances_dedupe_key`; older Laravel
     * defaults use `event_allowances_event_id_crew_id_allowance_type_id_recorded_at_unique`.
     * After a failed run the composite index may already be gone — only drop when present.
     */
    private function dropLegacyCompositeDedupeUniqueIfExists(): void
    {
        if (! Schema::hasTable('event_allowances')) {
            return;
        }

        $legacyNames = [
            'event_allowances_dedupe_key',
            'event_allowances_event_id_crew_id_allowance_type_id_recorded_at_unique',
        ];

        $targetColumns = ['allowance_type_id', 'crew_id', 'event_id', 'recorded_at'];
        sort($targetColumns);

        foreach (Schema::getIndexes('event_allowances') as $index) {
            if (empty($index['unique']) || ! empty($index['primary'])) {
                continue;
            }
            $name = $index['name'] ?? '';
            $cols = $index['columns'] ?? [];
            $sorted = $cols;
            sort($sorted);

            $matchesLegacyColumns = $sorted === $targetColumns;
            $matchesKnownName = in_array($name, $legacyNames, true);

            if ($matchesLegacyColumns || $matchesKnownName) {
                Schema::table('event_allowances', function (Blueprint $table) use ($name) {
                    $table->dropUnique($name);
                });

                return;
            }
        }
    }

    private function hasUniqueIndexOnColumn(string $table, string $column): bool
    {
        foreach (Schema::getIndexes($table) as $index) {
            if (empty($index['unique']) || ! empty($index['primary'])) {
                continue;
            }
            $cols = $index['columns'] ?? [];
            if (count($cols) === 1 && ($cols[0] ?? null) === $column) {
                return true;
            }
        }

        return false;
    }

    public function down(): void
    {
        Schema::table('event_allowances', function (Blueprint $table) {
            $table->dropUnique(['dedupe_key']);
        });

        Schema::table('event_allowances', function (Blueprint $table) {
            $table->dropForeign(['rejected_by']);
            $table->dropColumn([
                'source',
                'attachment_path',
                'rejection_comment',
                'approval_comment',
                'meal_slot',
                'meal_grant_date',
                'dedupe_key',
                'rejected_by',
                'rejected_at',
            ]);
        });

        Schema::table('event_allowances', function (Blueprint $table) {
            $table->unique(['event_id', 'crew_id', 'allowance_type_id', 'recorded_at'], 'event_allowances_dedupe_key');
        });

        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE event_allowances MODIFY COLUMN status ENUM('pending', 'approved', 'paid') NOT NULL DEFAULT 'pending'");
        }
    }
};
