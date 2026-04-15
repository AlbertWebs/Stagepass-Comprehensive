<?php

namespace App\Channels;

use App\Services\ExpoPushSender;
use App\Services\FcmSender;
use Illuminate\Notifications\Notification;

/**
 * Sends notifications to a device via push: Expo Push API (ExponentPushToken[...]) or Firebase (native device token).
 * Notifiable must implement routeNotificationForFcm() returning the token(s) stored on the user (e.g. fcm_token).
 * Notification must implement toFcm(notifiable) returning ['title' => ..., 'body' => ..., 'data' => [...]].
 */
class FcmChannel
{
    public function __construct(
        protected FcmSender $fcm,
        protected ExpoPushSender $expo
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
            if (! is_string($token) || $token === '') {
                continue;
            }
            if (ExpoPushSender::isExpoPushToken($token)) {
                $this->expo->send($token, $title, $body, $data);
            } else {
                $this->fcm->send($token, $title, $body, $data);
            }
        }
    }
}
