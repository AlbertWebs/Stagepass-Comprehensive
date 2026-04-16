<?php

namespace App\Notifications;

use App\Channels\FcmChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class InternalBroadcastNotification extends Notification
{
    use Queueable;

    public function __construct(
        public string $subject,
        public string $body,
        public string $senderName,
        public ?int $communicationId = null,
        public bool $sendAsMessage = true,
        public bool $sendAsEmail = false
    ) {}

    public function via(object $notifiable): array
    {
        $channels = [];
        if ($this->sendAsMessage) {
            $channels[] = 'database';
            if (! empty($notifiable->fcm_token)) {
                $channels[] = FcmChannel::class;
            }
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
            'communication_id' => $this->communicationId,
        ];
    }

    /**
     * @return array{title: string, body: string, data: array<string, string>}
     */
    public function toFcm(object $notifiable): array
    {
        return [
            'title' => $this->subject,
            'body' => $this->body,
            'data' => [
                'type' => 'internal_broadcast',
                'sender_name' => $this->senderName,
                'communication_id' => (string) ($this->communicationId ?? ''),
            ],
        ];
    }
}
