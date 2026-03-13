<?php

namespace App\Channels;

use App\Services\FcmSender;
use Illuminate\Notifications\Notification;

/**
 * Sends notifications to a device via Firebase Cloud Messaging (push).
 * Notifiable must implement routeNotificationForFcm() returning the FCM token(s).
 * Notification must implement toFcm(notifiable) returning ['title' => ..., 'body' => ..., 'data' => [...]].
 */
class FcmChannel
{
    public function __construct(
        protected FcmSender $fcm
    ) {}

    public function send(object $notifiable, Notification $notification): void
    {
        $tokens = $notifiable->routeNotificationFor('fcm', $notification);
        if (empty($tokens)) {
            return;
        }
        $tokens = is_array($tokens) ? $tokens : [$tokens];

        $message = $notification->toFcm($notifiable);
        if (! is_array($message) || empty($message['title']) || empty($message['body'])) {
            return;
        }
        $title = $message['title'];
        $body = $message['body'];
        $data = $message['data'] ?? [];

        foreach ($tokens as $token) {
            if (is_string($token) && $token !== '') {
                $this->fcm->send($token, $title, $body, $data);
            }
        }
    }
}
