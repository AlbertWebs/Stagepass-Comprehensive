<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class SettingsTableSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('settings')->upsert(array (
          0 => 
          array (
            'key' => 'allow_biometric_mobile_login',
            'value' => '1',
            'created_at' => NULL,
            'updated_at' => NULL,
          ),
), ['key']);
    }
}
