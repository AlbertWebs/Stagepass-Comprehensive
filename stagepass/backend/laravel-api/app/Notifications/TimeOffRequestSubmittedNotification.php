<?php

namespace App\Notifications;

use App\Models\TimeOffRequest;
use App\Channels\FcmChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TimeOffRequestSubmittedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public TimeOffRequest $timeOff) {}

    public function via(object $notifiable): array
    {
        $channels = ['database'];
        if (! empty($notifiable->email)) {
            $channels[] = 'mail';
        }
        if (! empty($notifiable->fcm_token)) {
            $channels[] = FcmChannel::class;
        }

        return $channels;
    }

    public function toMail(object $notifiable): MailMessage
    {
        $requesterName = $this->timeOff->user?->name ?? 'A user';
        $requesterEmail = $this->timeOff->user?->email ?? 'No email';
        $start = (string) $this->timeOff->start_date;
        $end = (string) $this->timeOff->end_date;
        $reason = trim((string) ($this->timeOff->reason ?? '')) ?: 'No reason provided';
        $notes = trim((string) ($this->timeOff->notes ?? ''));

        $mail = (new MailMessage)
            ->subject('New time off request submitted')
            ->greeting('Hello ' . ($notifiable->name ?? 'Admin') . ',')
            ->line('A new time off request has been submitted and is pending review.')
            ->line('**Requester:** ' . $requesterName . ' (' . $requesterEmail . ')')
            ->line('**Start date:** ' . $start)
            ->line('**End date:** ' . $end)
            ->line('**Reason:** ' . $reason);

        if ($notes !== '') {
            $mail->line('**Notes:** ' . $notes);
        }

        return $mail->line('Please review it in the Stagepass admin panel under Time Off.');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'time_off_request_submitted',
            'time_off_request_id' => $this->timeOff->id,
            'user_id' => $this->timeOff->user_id,
            'user_name' => $this->timeOff->user?->name,
            'start_date' => $this->timeOff->start_date?->toDateString(),
            'end_date' => $this->timeOff->end_date?->toDateString(),
        ];
    }

    public function toFcm(object $notifiable): array
    {
        $name = $this->timeOff->user?->name ?? 'A crew member';

        return [
            'title' => 'Time-off request',
            'body' => $name . ' requested time off from ' . $this->timeOff->start_date?->format('j M') . ' to ' . $this->timeOff->end_date?->format('j M') . '.',
            'data' => [
                'type' => 'time_off_request_submitted',
                'time_off_request_id' => (string) $this->timeOff->id,
                'user_id' => (string) $this->timeOff->user_id,
            ],
        ];
    }
}
