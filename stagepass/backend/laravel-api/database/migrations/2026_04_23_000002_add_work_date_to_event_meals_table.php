<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const NEW_UNIQUE = 'event_meals_event_user_work_date';

    private const LEGACY_UNIQUE_NAMES = [
        'event_meals_event_id_user_id_unique',
    ];

    public function up(): void
    {
        if (! Schema::hasTable('event_meals')) {
            return;
        }

        if (! Schema::hasColumn('event_meals', 'work_date')) {
            Schema::table('event_meals', function (Blueprint $table) {
                $table->string('work_date', 10)->nullable()->after('event_id');
            });
        }

        $meals = DB::table('event_meals')->select('id', 'event_id')->get();
        foreach ($meals as $row) {
            $raw = DB::table('events')->where('id', $row->event_id)->value('date');
            if ($raw === null) {
                continue;
            }
            $d = (string) (is_string($raw) ? substr($raw, 0, 10) : (string) $raw);
            if ($d !== '' && $d !== '0000-00-00') {
                DB::table('event_meals')->where('id', $row->id)->update(['work_date' => $d]);
            }
        }

        if (! Schema::hasColumn('event_meals', 'work_date')) {
            return;
        }

        if ($this->hasUniqueIndex(self::NEW_UNIQUE)) {
            $this->restoreEventMealsForeignKeys();

            return;
        }

        $this->dropEventMealsForeignKeys();
        $this->dropLegacyEventMealsUnique();

        Schema::table('event_meals', function (Blueprint $table) {
            $table->unique(['event_id', 'user_id', 'work_date'], self::NEW_UNIQUE);
        });

        $this->restoreEventMealsForeignKeys();
    }

    public function down(): void
    {
        if (! Schema::hasTable('event_meals') || ! Schema::hasColumn('event_meals', 'work_date')) {
            return;
        }

        $this->dropEventMealsForeignKeys();

        if ($this->hasUniqueIndex(self::NEW_UNIQUE)) {
            Schema::table('event_meals', function (Blueprint $table) {
                $table->dropUnique(self::NEW_UNIQUE);
            });
        }

        if (! $this->hasLegacyEventUserUnique()) {
            Schema::table('event_meals', function (Blueprint $table) {
                $table->unique(['event_id', 'user_id'], 'event_meals_event_id_user_id_unique');
            });
        }

        $this->restoreEventMealsForeignKeys();

        Schema::table('event_meals', function (Blueprint $table) {
            $table->dropColumn('work_date');
        });
    }

    private function dropEventMealsForeignKeys(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'mysql') {
            return;
        }

        Schema::table('event_meals', function (Blueprint $table) {
            foreach (['event_id', 'user_id'] as $column) {
                try {
                    $table->dropForeign([$column]);
                } catch (\Throwable) {
                    // Already dropped or named differently on this environment.
                }
            }
        });
    }

    private function restoreEventMealsForeignKeys(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'mysql') {
            return;
        }

        Schema::table('event_meals', function (Blueprint $table) {
            if (! $this->foreignKeyExists('event_id')) {
                $table->foreign('event_id')->references('id')->on('events')->cascadeOnDelete();
            }
            if (! $this->foreignKeyExists('user_id')) {
                $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            }
        });
    }

    private function dropLegacyEventMealsUnique(): void
    {
        if (! $this->hasLegacyEventUserUnique()) {
            return;
        }

        foreach (self::LEGACY_UNIQUE_NAMES as $name) {
            if ($this->hasUniqueIndex($name)) {
                Schema::table('event_meals', function (Blueprint $table) use ($name) {
                    $table->dropUnique($name);
                });

                return;
            }
        }

        foreach (Schema::getIndexes('event_meals') as $index) {
            if (empty($index['unique']) || ! empty($index['primary'])) {
                continue;
            }
            $cols = $index['columns'] ?? [];
            if ($cols === ['event_id', 'user_id'] || $cols === ['user_id', 'event_id']) {
                $name = $index['name'] ?? null;
                if ($name) {
                    Schema::table('event_meals', function (Blueprint $table) use ($name) {
                        $table->dropUnique($name);
                    });
                }

                return;
            }
        }
    }

    private function hasLegacyEventUserUnique(): bool
    {
        foreach (Schema::getIndexes('event_meals') as $index) {
            if (empty($index['unique']) || ! empty($index['primary'])) {
                continue;
            }
            $cols = $index['columns'] ?? [];
            if (count($cols) === 2 && in_array('event_id', $cols, true) && in_array('user_id', $cols, true)) {
                return true;
            }
        }

        return false;
    }

    private function hasUniqueIndex(string $name): bool
    {
        foreach (Schema::getIndexes('event_meals') as $index) {
            if (! empty($index['unique']) && ($index['name'] ?? '') === $name) {
                return true;
            }
        }

        return false;
    }

    private function foreignKeyExists(string $column): bool
    {
        if (Schema::getConnection()->getDriverName() !== 'mysql') {
            return true;
        }

        $database = Schema::getConnection()->getDatabaseName();
        $rows = DB::select(
            'SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL',
            [$database, 'event_meals', $column]
        );

        return count($rows) > 0;
    }
};
