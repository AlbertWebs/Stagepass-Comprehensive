<?php

namespace App\Notifications;

use App\Channels\FcmChannel;
use App\Models\EventUser;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class CrewCheckedInNotification extends Notification
{
    use Queueable;

    public function __construct(
        public EventUser $eventUser
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
     * Push notification payload for FCM (team leader's device).
     *
     * @return array{title: string, body: string, data: array<string, string>}
     */
    public function toFcm(object $notifiable): array
    {
        $user = $this->eventUser->user;
        $event = $this->eventUser->event;
        $time = $this->eventUser->checkin_time?->format('g:i A') ?? '—';

        return [
            'title' => 'Crew checked in',
            'body' => $user->name . ' checked in to ' . $event->name . ' at ' . $time . '.',
            'data' => [
                'type' => 'crew_checked_in',
                'event_id' => (string) $event->id,
                'event_name' => $event->name,
                'user_id' => (string) $user->id,
                'user_name' => $user->name,
                'checkin_time' => $this->eventUser->checkin_time?->toIso8601String() ?? '',
            ],
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $user = $this->eventUser->user;
        $event = $this->eventUser->event;
        $time = $this->eventUser->checkin_time?->format('g:i A') ?? '—';

        return (new MailMessage)
            ->subject('Crew checked in: ' . $user->name . ' – ' . $event->name)
            ->greeting('Hello ' . $notifiable->name . ',')
            ->line($user->name . ' has checked in to the following event.')
            ->line('**Event:** ' . $event->name)
            ->line('**Date:** ' . $event->date->format('l, j M Y'))
            ->line('**Check-in time:** ' . $time)
            ->line('You can view attendance in the Stagepass app.')
            ->salutation('Stagepass');
    }

    public function toArray(object $notifiable): array
    {
        $user = $this->eventUser->user;
        $event = $this->eventUser->event;

        return [
            'type' => 'crew_checked_in',
            'event_id' => $event->id,
            'event_name' => $event->name,
            'user_id' => $user->id,
            'user_name' => $user->name,
            'checkin_time' => $this->eventUser->checkin_time?->toIso8601String(),
        ];
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage($this->toArray($notifiable));
    }
}
