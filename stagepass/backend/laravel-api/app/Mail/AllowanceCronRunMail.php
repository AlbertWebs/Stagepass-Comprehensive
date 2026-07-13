<?php

namespace App\Mail;

use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Notification when the automatic meal allowance cron command runs.
 */
class AllowanceCronRunMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * @param  list<array{slot: string, label: string, scheduled_time: string, due_this_minute: bool, granted: int}>  $slotResults
     */
    public function __construct(
        public Carbon $sentAt,
        public string $appName,
        public string $appUrl,
        public string $timezone,
        public int $grantedCount,
        public ?string $hostname,
        public string $status = 'success',
        public array $slotResults = [],
        public ?string $errorMessage = null,
    ) {}

    public function envelope(): Envelope
    {
        $statusLabel = $this->status === 'success' ? 'OK' : 'FAILED';

        return new Envelope(
            subject: sprintf(
                '[%s] Allowance cron %s — %d granted (%s)',
                $this->appName,
                $statusLabel,
                $this->grantedCount,
                $this->sentAt->format('Y-m-d H:i:s')
            ),
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.allowance-cron-run',
        );
    }
}
