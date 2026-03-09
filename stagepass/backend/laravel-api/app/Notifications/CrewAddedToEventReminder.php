<?php

namespace App\Notifications;

use App\Models\Event;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class CrewAddedToEventReminder extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public Event $event,
        public ?string $roleInEvent = null
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'sms'];
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
