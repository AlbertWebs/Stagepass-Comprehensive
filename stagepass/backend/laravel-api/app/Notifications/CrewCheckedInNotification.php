<?php

namespace App\Notifications;

use App\Models\EventUser;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Notification;

class CrewCheckedInNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public EventUser $eventUser
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', 'broadcast'];
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
