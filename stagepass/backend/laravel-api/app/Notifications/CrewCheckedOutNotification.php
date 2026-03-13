<?php

namespace App\Notifications;

use App\Models\EventUser;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class CrewCheckedOutNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public EventUser $eventUser
    ) {}

    public function via(object $notifiable): array
    {
        $channels = ['database'];
        if (! empty($notifiable->email)) {
            $channels[] = 'mail';
        }
        return $channels;
    }

    public function toMail(object $notifiable): MailMessage
    {
        $user = $this->eventUser->user;
        $event = $this->eventUser->event;
        $checkoutTime = $this->eventUser->checkout_time?->format('g:i A') ?? '—';
        $totalHours = $this->eventUser->total_hours ? round($this->eventUser->total_hours, 1) . ' hours' : '—';

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
            'checkout_time' => $this->eventUser->checkout_time?->toIso8601String(),
            'total_hours' => $this->eventUser->total_hours,
        ];
    }
}
