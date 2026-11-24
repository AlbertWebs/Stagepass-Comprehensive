<?php

namespace App\Notifications;

use App\Models\Event;
use App\Channels\FcmChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class EventNearReminder extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public Event $event
    ) {}

    public function via(object $notifiable): array
    {
        $channels = ['database', 'mail', 'sms'];
        if (! empty($notifiable->fcm_token)) $channels[] = FcmChannel::class;
        return $channels;
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'event_reminder',
            'event_id' => $this->event->id,
            'event_name' => $this->event->name,
            'event_date' => $this->event->date->toDateString(),
        ];
    }

    public function toFcm(object $notifiable): array
    {
        return [
            'title' => 'Upcoming project',
            'body' => $this->event->name . ' starts ' . $this->event->date->format('D, j M') . ' at ' . $this->event->start_time . '.',
            'data' => [
                'type' => 'event_reminder',
                'event_id' => (string) $this->event->id,
                'event_name' => $this->event->name,
            ],
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $date = $this->event->date->format('l, j M Y');
        $time = $this->event->start_time;
        $location = $this->event->location_name ?? 'See event details';

        return (new MailMessage)
            ->subject('Reminder: Event tomorrow – ' . $this->event->name)
            ->greeting('Hello ' . $notifiable->name . ',')
            ->line('This is a reminder that you are on the crew for the following event.')
            ->line('**Event:** ' . $this->event->name)
            ->line('**Date:** ' . $date)
            ->line('**Time:** ' . $time)
            ->line('**Location:** ' . $location)
            ->line('Please check in via the Stagepass app when you arrive on site.')
            ->salutation('Stagepass Team');
    }

    public function toSms(object $notifiable): ?string
    {
        $date = $this->event->date->format('j M');
        return "Stagepass reminder: \"{$this->event->name}\" is coming up on {$date} at {$this->event->start_time}. Remember to check in via the app when you arrive.";
    }
}
