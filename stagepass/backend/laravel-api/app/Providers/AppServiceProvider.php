<?php

namespace App\Providers;

use App\Channels\SmsChannel;
use App\Events\CrewCheckedIn;
use App\Events\CrewCheckedOut;
use App\Listeners\SendCheckInNotificationToTeamLeader;
use App\Listeners\SendCheckOutNotificationToTeamLeader;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        Event::listen(CrewCheckedIn::class, SendCheckInNotificationToTeamLeader::class);
        Event::listen(CrewCheckedOut::class, SendCheckOutNotificationToTeamLeader::class);

        Notification::extend('sms', function ($app) {
            return $app->make(SmsChannel::class);
        });
    }
}
