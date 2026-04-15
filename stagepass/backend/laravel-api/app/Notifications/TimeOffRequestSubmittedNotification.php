<?php

namespace App\Notifications;

use App\Models\TimeOffRequest;
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
        return ['mail'];
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
}
