<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;

class CustomResetPasswordNotification extends ResetPassword implements ShouldQueue
{
    use Queueable;

    public function toMail(object $notifiable): MailMessage
    {
        $base = rtrim((string) config('app.frontend_password_reset_url', config('app.url')), '/');
        $url = $base . '?token=' . urlencode($this->token) . '&email=' . urlencode($notifiable->getEmailForPasswordReset());

        return (new MailMessage)
            ->subject('Reset your Stagepass password')
            ->greeting('Hello ' . $notifiable->name . ',')
            ->line('You requested a password reset for your Stagepass account.')
            ->action('Reset password', $url)
            ->line('This link will expire in ' . config('auth.passwords.users.expire') . ' minutes.')
            ->line('If you did not request this, you can ignore this email.')
            ->salutation('Stagepass Team');
    }
}
