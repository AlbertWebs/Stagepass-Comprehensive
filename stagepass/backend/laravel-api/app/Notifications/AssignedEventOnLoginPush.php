<?php

namespace App\Notifications;

use App\Channels\FcmChannel;
use App\Models\Event;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class AssignedEventOnLoginPush extends Notification
{
    use Queueable;

    public function __construct(
        public Event $event
    ) {}

    public function via(object $notifiable): array
    {
        if (empty($notifiable->fcm_token)) {
            return [];
        }

        return [FcmChannel::class];
    }

    /**
     * @return array{title: string, body: string, data: array<string, string>}
     */
    public function toFcm(object $notifiable): array
    {
        return [
            'title' => 'Event assigned today',
            'body' => 'You are assigned to '.$this->event->name.'. Open My Events to check in.',
            'data' => [
                'type' => 'assigned_event_login',
                'event_id' => (string) $this->event->id,
                'event_name' => (string) $this->event->name,
                'event_date' => $this->event->date->toDateString(),
            ],
        ];
    }
}

