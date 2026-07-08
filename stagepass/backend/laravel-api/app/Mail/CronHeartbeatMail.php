<?php

namespace App\Mail;

use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Proof-of-life email when the Laravel scheduler / cron runs.
 */
class CronHeartbeatMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Carbon $sentAt,
        public string $appName,
        public string $appUrl,
        public string $timezone,
        public ?string $hostname,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: sprintf(
                '[%s] Cron heartbeat %s',
                $this->appName,
                $this->sentAt->format('Y-m-d H:i:s')
            ),
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.cron-heartbeat',
        );
    }
}
