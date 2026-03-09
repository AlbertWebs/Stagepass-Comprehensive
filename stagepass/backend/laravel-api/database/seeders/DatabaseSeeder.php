<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     *
     * Test credentials (all use password "password" for web, PIN "1234" for mobile):
     *
     * | Role        | Web (email)              | Mobile (username) | App experience   |
     * |-------------|---------------------------|-------------------|------------------|
     * | Admin       | admin@stagepass.com      | admin             | Full access      |
     * | Director    | director@stagepass.com   | director          | Admin            |
     * | Team Leader | teamleader@stagepass.com | teamleader        | Leader dashboard |
     * | Crew        | crew@stagepass.com        | crew              | Assigned events  |
     * | Accountant  | accountant@stagepass.com  | accountant        | Payments/finance |
     * | Logistics   | logistics@stagepass.com  | logistics         | Equipment/transport |
     * | Operations  | operations@stagepass.com | operations        | Event monitoring |
     */
    public function run(): void
    {
        $this->call([RoleSeeder::class, SettingsSeeder::class]);

        $defaults = [
            'password' => Hash::make('password'),
            'pin' => '1234',
            'remember_token' => Str::random(10),
        ];

        $users = [
            ['email' => 'admin@stagepass.com', 'name' => 'Stagepass Admin', 'username' => 'admin', 'role' => 'super_admin'],
            ['email' => 'director@stagepass.com', 'name' => 'Director', 'username' => 'director', 'role' => 'director'],
            ['email' => 'teamleader@stagepass.com', 'name' => 'Team Leader', 'username' => 'teamleader', 'role' => 'team_leader'],
            ['email' => 'crew@stagepass.com', 'name' => 'Crew Member', 'username' => 'crew', 'role' => 'permanent_employee'],
            ['email' => 'accountant@stagepass.com', 'name' => 'Accountant', 'username' => 'accountant', 'role' => 'accountant'],
            ['email' => 'logistics@stagepass.com', 'name' => 'Logistics', 'username' => 'logistics', 'role' => 'logistics'],
            ['email' => 'operations@stagepass.com', 'name' => 'Operations', 'username' => 'operations', 'role' => 'operations'],
        ];

        foreach ($users as $u) {
            $roleName = $u['role'];
            $attrs = array_merge(array_diff_key($u, ['role' => 1]), $defaults);
            $user = User::firstOrCreate(
                ['email' => $u['email']],
                $attrs
            );
            $user->roles()->sync([Role::where('name', $roleName)->firstOrFail()->id]);
            if (! $user->username || ! $user->pin) {
                $user->update(['username' => $u['username'], 'pin' => '1234']);
            }
        }

        $testUser = User::firstOrCreate(
            ['email' => 'test@example.com'],
            [
                'name' => 'Test User',
                'username' => 'testuser',
                'password' => Hash::make('password'),
                'pin' => '1234',
                'remember_token' => Str::random(10),
            ]
        );
        if (! $testUser->username) {
            $testUser->update(['username' => 'testuser', 'pin' => '1234']);
        }
    }
}
