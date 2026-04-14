<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Resets known demo / QA accounts so email+password (web) and username+PIN (mobile) match README.
 *
 * Safe to run alone: `php artisan db:seed --class=ResetDemoCredentialsSeeder`
 * (roles must exist — run `php artisan db:seed` once, or `RoleSeeder` first.)
 */
class ResetDemoCredentialsSeeder extends Seeder
{
    public const ADMIN_EMAIL = 'admin@stagepass.com';

    public const TEST_EMAIL = 'test@example.com';

    /** Web + mobile (PIN is stored hashed via User cast). */
    public const DEFAULT_PASSWORD = 'password';

    public const DEFAULT_PIN = '1234';

    public function run(): void
    {
        if (! Role::where('name', 'super_admin')->exists()) {
            $this->call(RoleSeeder::class);
        }

        $superAdminId = Role::where('name', 'super_admin')->firstOrFail()->id;
        $directorId = Role::where('name', 'director')->firstOrFail()->id;

        $admin = User::updateOrCreate(
            ['email' => self::ADMIN_EMAIL],
            [
                'name' => 'Stagepass Admin',
                'username' => 'admin',
                'password' => self::DEFAULT_PASSWORD,
                'pin' => self::DEFAULT_PIN,
                'remember_token' => Str::random(10),
            ]
        );
        $admin->roles()->sync([$superAdminId]);

        $test = User::updateOrCreate(
            ['email' => self::TEST_EMAIL],
            [
                'name' => 'Test User',
                'username' => 'testuser',
                'password' => self::DEFAULT_PASSWORD,
                'pin' => self::DEFAULT_PIN,
                'remember_token' => Str::random(10),
            ]
        );
        $test->roles()->sync([$directorId]);
    }
}
