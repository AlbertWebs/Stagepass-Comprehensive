<?php

namespace App\Notifications;

use App\Channels\FcmChannel;
use App\Models\Event;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class CrewAddedToEventReminder extends Notification
{
    use Queueable;

    public function __construct(
        public Event $event,
        public ?string $roleInEvent = null
    ) {}

    public function via(object $notifiable): array
    {
        $channels = ['mail', 'sms'];
        if (! empty($notifiable->fcm_token)) {
            $channels[] = FcmChannel::class;
        }

        return $channels;
    }

    /**
     * @return array{title: string, body: string, data: array<string, string>}
     */
    public function toFcm(object $notifiable): array
    {
        $date = $this->event->date->format('D, j M Y');
        $location = $this->event->location_name ?? 'See event details';

        return [
            'title' => 'Added to event',
            'body' => 'You were added to '.$this->event->name.' on '.$date.' at '.$this->event->start_time.'.',
            'data' => [
                'type' => 'crew_added_to_event',
                'event_id' => (string) $this->event->id,
                'event_name' => $this->event->name,
                'event_date' => $this->event->date->toDateString(),
                'start_time' => (string) $this->event->start_time,
                'location_name' => $location,
                'role_in_event' => (string) ($this->roleInEvent ?? ''),
            ],
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $date = $this->event->date->format('l, j M Y');
        $time = $this->event->start_time;
        $location = $this->event->location_name ?? 'See event details';

        return (new MailMessage)
            ->subject('You\'ve been added to an event: ' . $this->event->name)
            ->greeting('Hello ' . $notifiable->name . ',')
            ->line('You have been added to the following event.')
            ->line('**Event:** ' . $this->event->name)
            ->line('**Date:** ' . $date)
            ->line('**Time:** ' . $time)
            ->line('**Location:** ' . $location)
            ->when($this->roleInEvent, fn ($mail) => $mail->line('**Your role:** ' . $this->roleInEvent))
            ->line('Please check in via the Stagepass app when you arrive on site.')
            ->salutation('Stagepass Team');
    }

    public function toSms(object $notifiable): ?string
    {
        $date = $this->event->date->format('j M');
        return "Stagepass: You've been added to \"{$this->event->name}\" on {$date} at {$this->event->start_time}. Check in via the app when you arrive.";
    }
}
