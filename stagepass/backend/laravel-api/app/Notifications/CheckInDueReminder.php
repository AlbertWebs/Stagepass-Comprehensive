<?php

namespace App\Notifications;

use App\Models\Event;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class CheckInDueReminder extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public Event $event
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'sms'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $date = $this->event->date->format('l, j M Y');
        $time = $this->event->start_time;

        return (new MailMessage)
            ->subject('Reminder: Please check in – ' . $this->event->name)
            ->greeting('Hello ' . $notifiable->name . ',')
            ->line('You have not yet checked in for the following event.')
            ->line('**Event:** ' . $this->event->name)
            ->line('**Date:** ' . $date . ' at ' . $time)
            ->line('Please open the Stagepass app and check in when you are at the event location.')
            ->salutation('Stagepass Team');
    }

    public function toSms(object $notifiable): ?string
    {
        $date = $this->event->date->format('j M');
        return "Stagepass: You haven't checked in for \"{$this->event->name}\" ({$date}). Please check in via the app when you're on site.";
    }
}
