<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class InternalBroadcastNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public string $subject,
        public string $body,
        public string $senderName,
        public bool $sendAsMessage = true,
        public bool $sendAsEmail = false
    ) {}

    public function via(object $notifiable): array
    {
        $channels = [];
        if ($this->sendAsMessage) {
            $channels[] = 'database';
        }
        if ($this->sendAsEmail) {
            $channels[] = 'mail';
        }
        return $channels;
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject($this->subject)
            ->greeting('Hello ' . $notifiable->name . ',')
            ->line($this->body)
            ->line('— ' . $this->senderName)
            ->salutation('Stagepass');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'subject' => $this->subject,
            'body' => $this->body,
            'sender_name' => $this->senderName,
            'type' => 'internal_broadcast',
        ];
    }
}
