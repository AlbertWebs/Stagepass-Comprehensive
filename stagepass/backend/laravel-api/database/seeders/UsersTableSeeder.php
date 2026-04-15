<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class UsersTableSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('users')->insert([
            [
                'id' => 1,
                'name' => 'Albert Muhatia Mmboyi',
                'email' => 'test@example.com',
                'username' => 'testuser',
                'password' => Hash::make('1234'),
                'phone' => null,
                'created_at' => '2026-03-05 16:12:53',
                'updated_at' => '2026-03-05 16:12:53',
            ],
            [
                'id' => 2,
                'name' => 'Stagepass Admin',
                'email' => 'admin@stagepass.com',
                'username' => 'admin',
                'password' => Hash::make('1234'),
                'phone' => null,
                'created_at' => '2026-03-05 16:52:01',
                'updated_at' => '2026-03-05 16:52:01',
            ],
            [
                'id' => 3,
                'name' => 'Albert Muhatia',
                'email' => 'albertmuhatia@gmail.com',
                'username' => 'albro',
                'password' => Hash::make('1234'),
                'phone' => '0723014032',
                'created_at' => '2026-03-05 18:55:10',
                'updated_at' => '2026-03-05 18:55:10',
            ],
            [
                'id' => 6,
                'name' => 'Director',
                'email' => 'director@stagepass.com',
                'username' => 'director',
                'password' => Hash::make('1234'),
                'phone' => null,
                'created_at' => '2026-03-08 12:13:12',
                'updated_at' => '2026-03-08 12:13:12',
            ],
            [
                'id' => 7,
                'name' => 'Accountant',
                'email' => 'accountant@stagepass.com',
                'username' => 'accountant',
                'password' => Hash::make('1234'),
                'phone' => null,
                'created_at' => '2026-03-08 12:13:12',
                'updated_at' => '2026-03-08 12:13:12',
            ],
            [
                'id' => 11,
                'name' => 'Hussein Maingi',
                'email' => 'hussein@stagepass.co.ke',
                'username' => 'hussein',
                'password' => Hash::make('1234'),
                'phone' => null,
                'created_at' => '2026-04-13 11:14:08',
                'updated_at' => '2026-04-13 11:14:08',
            ],
            [
                'id' => 12,
                'name' => 'Alfred Osano',
                'email' => 'alfred@stagepass.co.ke',
                'username' => 'Osano',
                'password' => Hash::make('1234'),
                'phone' => null,
                'created_at' => '2026-04-13 11:14:52',
                'updated_at' => '2026-04-13 11:14:52',
            ],
            [
                'id' => 13,
                'name' => 'Francis amhale',
                'email' => 'Frank@stagepass.co.ke',
                'username' => 'Frank',
                'password' => Hash::make('1234'),
                'phone' => null,
                'created_at' => '2026-04-13 11:15:36',
                'updated_at' => '2026-04-13 11:15:36',
            ],
            [
                'id' => 14,
                'name' => 'Levi Mogire',
                'email' => 'levi@stagepass.co.ke',
                'username' => 'Levi',
                'password' => Hash::make('1234'),
                'phone' => null,
                'created_at' => '2026-04-13 11:16:35',
                'updated_at' => '2026-04-13 11:16:35',
            ],
        ]);
    }
}
