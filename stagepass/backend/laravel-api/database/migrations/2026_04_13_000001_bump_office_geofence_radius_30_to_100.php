<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Raise default office check-in geofence from 30 m to 100 m for existing installs
     * that still use the previous default (does not change custom values).
     */
    public function up(): void
    {
        if (! Schema::hasTable('settings')) {
            return;
        }
        DB::table('settings')
            ->where('key', 'office_radius_m')
            ->whereIn('value', ['30', '30.0', '30.00'])
            ->update(['value' => '100']);
    }

    public function down(): void
    {
        // Intentionally no-op: cannot safely distinguish this migration from a manual 100 m setting.
    }
};
