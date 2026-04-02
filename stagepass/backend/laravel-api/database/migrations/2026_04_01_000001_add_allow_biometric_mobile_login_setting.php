<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (! \Illuminate\Support\Facades\Schema::hasTable('settings')) {
            return;
        }
        DB::table('settings')->updateOrInsert(
            ['key' => 'allow_biometric_mobile_login'],
            ['value' => '1']
        );
    }

    public function down(): void
    {
        if (! \Illuminate\Support\Facades\Schema::hasTable('settings')) {
            return;
        }
        DB::table('settings')->where('key', 'allow_biometric_mobile_login')->delete();
    }
};
