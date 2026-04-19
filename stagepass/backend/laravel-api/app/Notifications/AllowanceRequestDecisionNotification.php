<?php

namespace App\Notifications;

use App\Channels\FcmChannel;
use App\Models\EventAllowance;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class AllowanceRequestDecisionNotification extends Notification
{
    use Queueable;

    public function __construct(
        public EventAllowance $allowance,
        public bool $approved
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
        if ($this->approved) {
            return [
                'title' => 'Allowance approved',
                'body' => 'Your allowance request has been approved.',
                'data' => [
                    'type' => 'allowance_request_approved',
                    'allowance_id' => (string) $this->allowance->id,
                    'event_id' => (string) $this->allowance->event_id,
                ],
            ];
        }

        return [
            'title' => 'Allowance rejected',
            'body' => 'Your allowance request was rejected. Please review the comment.',
            'data' => [
                'type' => 'allowance_request_rejected',
                'allowance_id' => (string) $this->allowance->id,
                'event_id' => (string) $this->allowance->event_id,
            ],
        ];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => $this->approved ? 'allowance_request_approved' : 'allowance_request_rejected',
            'allowance_id' => $this->allowance->id,
            'event_id' => $this->allowance->event_id,
            'rejection_comment' => $this->allowance->rejection_comment,
        ];
    }
}
