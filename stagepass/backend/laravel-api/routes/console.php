<?php

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
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

/*
|--------------------------------------------------------------------------
| Reminder cron (uncomment when setting up cron)
|--------------------------------------------------------------------------
| Run: php artisan schedule:work (dev) or add to crontab: * * * * * cd /path && php artisan schedule:run
|
| Schedule::command('reminders:event-near')->dailyAt('08:00');  // Event-near reminders at 8am
| Schedule::command('reminders:checkin-due')->everyThirtyMinutes(); // Check-in due every 30 min
*/
