<?php

namespace App\Notifications;

use App\Models\EventAttendanceSession;
use App\Models\EventUser;
use App\Channels\FcmChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class CrewCheckedOutNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public EventUser $eventUser,
        public ?EventAttendanceSession $session = null
    ) {}

    public function via(object $notifiable): array
    {
        $channels = ['database'];
        if (! empty($notifiable->email)) {
            $channels[] = 'mail';
        }
        if (! empty($notifiable->fcm_token)) {
            $channels[] = FcmChannel::class;
        }
        return $channels;
    }

    /** @return array{title: string, body: string, data: array<string, string>} */
    public function toFcm(object $notifiable): array
    {
        $user = $this->eventUser->user;
        $event = $this->eventUser->event;
        $checkout = $this->session?->checkout_time ?? $this->eventUser->checkout_time;

        return [
            'title' => 'Crew checked out',
            'body' => $user->name . ' checked out from ' . $event->name . ' at ' . ($checkout?->format('g:i A') ?? '—') . '.',
            'data' => [
                'type' => 'crew_checked_out',
                'event_id' => (string) $event->id,
                'event_name' => $event->name,
                'user_id' => (string) $user->id,
                'user_name' => $user->name,
                'checkout_time' => $checkout?->toIso8601String() ?? '',
                'total_hours' => (string) ($this->session?->total_hours ?? $this->eventUser->total_hours ?? ''),
            ],
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $user = $this->eventUser->user;
        $event = $this->eventUser->event;
        $checkoutTime = $this->session?->checkout_time?->format('g:i A')
            ?? $this->eventUser->checkout_time?->format('g:i A')
            ?? '—';
        $th = $this->session?->total_hours ?? $this->eventUser->total_hours;
        $totalHours = $th ? round((float) $th, 1) . ' hours' : '—';

        return (new MailMessage)
            ->subject('Crew checked out: ' . $user->name . ' – ' . $event->name)
            ->greeting('Hello ' . $notifiable->name . ',')
            ->line($user->name . ' has checked out from the following event.')
            ->line('**Event:** ' . $event->name)
            ->line('**Date:** ' . $event->date->format('l, j M Y'))
            ->line('**Check-out time:** ' . $checkoutTime)
            ->line('**Total hours:** ' . $totalHours)
            ->line('You can view attendance in the Stagepass app.')
            ->salutation('Stagepass');
    }

    public function toArray(object $notifiable): array
    {
        $user = $this->eventUser->user;
        $event = $this->eventUser->event;

        return [
            'type' => 'crew_checked_out',
            'event_id' => $event->id,
            'event_name' => $event->name,
            'user_id' => $user->id,
            'user_name' => $user->name,
            'checkout_time' => ($this->session?->checkout_time ?? $this->eventUser->checkout_time)?->toIso8601String(),
            'total_hours' => $this->session?->total_hours ?? $this->eventUser->total_hours,
        ];
    }
}
