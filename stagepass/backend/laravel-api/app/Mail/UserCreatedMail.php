<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Sent when an admin creates a user from the web admin.
 * Intentionally not queued: default QUEUE_CONNECTION=database would require a worker;
 * synchronous send works once MAIL_* is configured (smtp, ses, mailgun, etc.).
 */
class UserCreatedMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * @param  string|null  $webPassword  Plain web password when set/changed; null on resend if unchanged (email explains Forgot password).
     * @param  string|null  $mobilePin  Plain PIN when set/changed; null if not included in this email.
     * @param  bool  $isResend  True when sent from admin "Send welcome email" (existing user); adjusts copy.
     */
    public function __construct(
        public User $user,
        public ?string $webPassword,
        public ?string $mobilePin = null,
        public bool $isResend = false,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->isResend
                ? 'Your Stagepass sign-in details'
                : 'Your Stagepass account has been created',
            from: config('mail.from'),
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.user-created',
        );
    }
}
