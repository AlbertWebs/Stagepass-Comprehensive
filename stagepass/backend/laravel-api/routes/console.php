<?php

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('user:grant-admin {email}', function (string $email) {
    $user = User::query()
        ->whereRaw('LOWER(email) = ?', [mb_strtolower(trim($email))])
        ->first();

    if (! $user) {
        $this->error("User not found for email: {$email}");
        return self::FAILURE;
    }

    $adminRole = Role::query()->where('name', 'admin')->first();
    if (! $adminRole) {
        $this->error('Role "admin" does not exist. Seed roles first.');
        return self::FAILURE;
    }

    $user->roles()->syncWithoutDetaching([$adminRole->id]);

    $this->info("Granted admin role to {$user->email} (user #{$user->id}).");
    return self::SUCCESS;
})->purpose('Grant admin role to a user by email');

Artisan::command('user:create-test-credentials {--password=Test@12345} {--rewrite-email}', function () {
    $password = (string) $this->option('password');
    $rewriteEmail = (bool) $this->option('rewrite-email');

    if (trim($password) === '') {
        $this->error('Password cannot be empty.');
        return self::FAILURE;
    }

    $users = User::query()->with('roles:id,name')->orderBy('id')->get();
    if ($users->isEmpty()) {
        $this->warn('No users found.');
        return self::SUCCESS;
    }

    $rows = [];
    foreach ($users as $user) {
        $updates = ['password' => Hash::make($password)];

        if ($rewriteEmail) {
            $primaryRole = $user->roles->pluck('name')->first() ?? 'user';
            $updates['email'] = strtolower("{$primaryRole}{$user->id}@stagepass.test");
        }

        $user->update($updates);
        $user->refresh();

        $rows[] = [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'password' => $password,
            'roles' => $user->roles->pluck('name')->implode(', ') ?: '-',
        ];
    }

    $this->info("Updated {$users->count()} users with test credentials.");
    $this->table(['ID', 'Name', 'Email', 'Password', 'Roles'], $rows);

    if (! $rewriteEmail) {
        $this->comment('Emails were preserved. Use existing emails with the shared test password above.');
    } else {
        $this->comment('Emails were rewritten to *@stagepass.test for testing.');
    }

    return self::SUCCESS;
})->purpose('Create test credentials for all users');

/*
|--------------------------------------------------------------------------
| Reminder cron (uncomment when setting up cron)
|--------------------------------------------------------------------------
| Run: php artisan schedule:work (dev) or add to crontab: * * * * * cd /path && php artisan schedule:run
|
| Schedule::command('reminders:event-near')->dailyAt('08:00');  // Event-near reminders at 8am
| Schedule::command('reminders:checkin-due')->everyThirtyMinutes(); // Check-in due every 30 min
*/
