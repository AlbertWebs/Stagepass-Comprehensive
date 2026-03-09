<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
|--------------------------------------------------------------------------
| Reminder cron (uncomment when setting up cron)
|--------------------------------------------------------------------------
| Run: php artisan schedule:work (dev) or add to crontab: * * * * * cd /path && php artisan schedule:run
|
| Schedule::command('reminders:event-near')->dailyAt('08:00');  // Event-near reminders at 8am
| Schedule::command('reminders:checkin-due')->everyThirtyMinutes(); // Check-in due every 30 min
*/
