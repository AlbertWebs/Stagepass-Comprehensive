<?php

namespace App\Notifications;

use App\Channels\FcmChannel;
use App\Models\Event;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TeamLeaderAssignedNotification extends Notification
{
    use Queueable;

    public function __construct(
        public Event $event
    ) {}

    public function via(object $notifiable): array
    {
        $channels = ['database', 'broadcast'];
        if (! empty($notifiable->email)) {
            $channels[] = 'mail';
        }
        if (! empty($notifiable->fcm_token)) {
            $channels[] = FcmChannel::class;
        }

        return $channels;
    }

    /**
     * Push notification payload (Expo or FCM via {@see FcmChannel}).
     *
     * @return array{title: string, body: string, data: array<string, string>}
     */
    public function toFcm(object $notifiable): array
    {
        $event = $this->event;
        $dateLabel = $event->date->format('D, j M Y');

        return [
            'title' => 'You\'re the team leader',
            'body' => 'You have been assigned as team leader for '.$event->name.' ('.$dateLabel.'). Open the app for details.',
            'data' => [
                'type' => 'team_leader_assigned',
                'event_id' => (string) $event->id,
                'event_name' => $event->name,
                'event_date' => $event->date->toDateString(),
            ],
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $event = $this->event;

        return (new MailMessage)
            ->subject('Team leader: '.$event->name)
            ->greeting('Hello '.$notifiable->name.',')
            ->line('You have been assigned as **team leader** for the following event.')
            ->line('**Event:** '.$event->name)
            ->line('**Date:** '.$event->date->format('l, j M Y'))
            ->line('Open the Stagepass mobile app to manage crew and check-ins.')
            ->salutation('Stagepass');
    }

    public function toArray(object $notifiable): array
    {
        $event = $this->event;

        return [
            'type' => 'team_leader_assigned',
            'event_id' => $event->id,
            'event_name' => $event->name,
            'event_date' => $event->date->toDateString(),
        ];
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage($this->toArray($notifiable));
    }
}
