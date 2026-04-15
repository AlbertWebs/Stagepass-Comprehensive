<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $driver = DB::getDriverName();
        if (!in_array($driver, ['mysql', 'mariadb'], true)) {
            return;
        }

        if (!Schema::hasTable('jobs')) {
            return;
        }

        // Laravel database queue stores unix timestamps in these columns.
        // Some environments had datetime created_at from snapshot schema.
        DB::statement('ALTER TABLE `jobs` MODIFY `reserved_at` INT UNSIGNED NULL');
        DB::statement('ALTER TABLE `jobs` MODIFY `available_at` INT UNSIGNED NOT NULL');
        DB::statement('ALTER TABLE `jobs` MODIFY `created_at` INT UNSIGNED NOT NULL');
    }

    public function down(): void
    {
        $driver = DB::getDriverName();
        if (!in_array($driver, ['mysql', 'mariadb'], true)) {
            return;
        }

        if (!Schema::hasTable('jobs')) {
            return;
        }

        // Roll back to broader-compatible previous shape.
        DB::statement('ALTER TABLE `jobs` MODIFY `reserved_at` INT NULL');
        DB::statement('ALTER TABLE `jobs` MODIFY `available_at` INT NOT NULL');
        DB::statement('ALTER TABLE `jobs` MODIFY `created_at` DATETIME NULL');
    }
};
