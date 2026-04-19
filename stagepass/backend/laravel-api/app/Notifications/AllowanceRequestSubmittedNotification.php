<?php

namespace App\Notifications;

use App\Channels\FcmChannel;
use App\Models\EventAllowance;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class AllowanceRequestSubmittedNotification extends Notification
{
    use Queueable;

    public function __construct(
        public EventAllowance $allowance
    ) {}

    public function via(object $notifiable): array
    {
        $channels = ['database'];
        if (! empty($notifiable->fcm_token)) {
            $channels[] = FcmChannel::class;
        }

        return $channels;
    }

    public function toFcm(object $notifiable): array
    {
        $this->allowance->loadMissing(['crew', 'event', 'type']);
        $crew = $this->allowance->crew;
        $event = $this->allowance->event;
        $typeName = $this->allowance->type?->name ?? 'Allowance';

        return [
            'title' => 'Allowance Request Submitted',
            'body' => 'A crew member has requested a ' . $typeName . ' allowance for this event.',
            'data' => [
                'type' => 'allowance_request_submitted',
                'allowance_id' => (string) $this->allowance->id,
                'event_id' => (string) ($event?->id ?? ''),
                'event_name' => (string) ($event?->name ?? ''),
                'user_name' => (string) ($crew?->name ?? ''),
                'amount' => (string) $this->allowance->amount,
                'allowance_type' => $typeName,
            ],
        ];
    }

    public function toArray(object $notifiable): array
    {
        $this->allowance->loadMissing(['crew', 'event', 'type']);

        return [
            'type' => 'allowance_request_submitted',
            'allowance_id' => $this->allowance->id,
            'event_id' => $this->allowance->event_id,
            'event_name' => $this->allowance->event?->name,
            'user_name' => $this->allowance->crew?->name,
            'amount' => (float) $this->allowance->amount,
            'allowance_type' => $this->allowance->type?->name,
        ];
    }
}
