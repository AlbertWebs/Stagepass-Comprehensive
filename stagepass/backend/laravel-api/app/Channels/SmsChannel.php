<?php

namespace App\Channels;

use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Log;

/**
 * SMS notification channel.
 * Configure SMS_DRIVER in .env: 'log' (default) logs the message; 'twilio' or custom driver can be added later.
 */
class SmsChannel
{
    public function send(object $notifiable, Notification $notification): void
    {
        $message = $notification->toSms($notifiable);
        if (! $message) {
            return;
        }

        $to = $notifiable->routeNotificationFor('sms', $notification) ?? $notifiable->phone ?? null;
        if (! $to) {
            Log::channel('single')->info('SMS reminder skipped: no phone number', [
                'notifiable_id' => $notifiable->id,
                'notification' => get_class($notification),
            ]);
            return;
        }

        $driver = config('services.sms.driver', 'log');

        if ($driver === 'log') {
            Log::channel('single')->info('SMS reminder (log driver)', [
                'to' => $to,
                'message' => $message,
            ]);
            return;
        }

        // Future: Twilio, Vonage, etc.
        // if ($driver === 'twilio') { ... }
    }
}
