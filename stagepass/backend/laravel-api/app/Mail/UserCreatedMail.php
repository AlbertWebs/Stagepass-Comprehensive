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
     * @param  string  $webPassword  Plain password for web admin (email) sign-in — only for this transactional email.
     * @param  string|null  $mobilePin  Plain PIN for mobile app, if the admin set one.
     */
    public function __construct(
        public User $user,
        public string $webPassword,
        public ?string $mobilePin = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Your Stagepass account has been created',
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
