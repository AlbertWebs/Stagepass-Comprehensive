<?php

namespace App\Notifications;

use App\Channels\FcmChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Notification;

/** Common database + Firebase push payload for workflow changes. */
class WorkflowPushNotification extends Notification implements ShouldQueue
{
    use Queueable;

    /** @param array<string, scalar|null> $data */
    public function __construct(
        public string $title,
        public string $body,
        public string $type,
        public array $data = [],
    ) {}

    public function via(object $notifiable): array
    {
        $channels = ['database', 'broadcast'];
        if (! empty($notifiable->fcm_token)) {
            $channels[] = FcmChannel::class;
        }

        return $channels;
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return ['type' => $this->type, 'title' => $this->title, 'body' => $this->body] + $this->data;
    }

    /** @return array{title: string, body: string, data: array<string, mixed>} */
    public function toFcm(object $notifiable): array
    {
        return [
            'title' => $this->title,
            'body' => $this->body,
            'data' => ['type' => $this->type] + $this->data,
        ];
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage($this->toArray($notifiable));
    }
}
