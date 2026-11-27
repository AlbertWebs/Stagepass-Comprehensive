<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('event_allowances')
            ->where('source', 'automatic')
            ->whereIn('status', ['approved', 'paid'])
            ->whereNull('hr_verified_at')
            ->update([
                'hr_verified_at' => DB::raw('COALESCE(approved_at, paid_at, recorded_at, created_at)'),
            ]);
    }

    public function down(): void
    {
        // Keep the verification timestamps in place if this data-only migration is rolled back.
    }
};
