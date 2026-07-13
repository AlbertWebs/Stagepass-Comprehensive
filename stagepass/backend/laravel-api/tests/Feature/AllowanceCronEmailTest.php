<?php

namespace Tests\Feature;

use App\Mail\AllowanceCronRunMail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class AllowanceCronEmailTest extends TestCase
{
    use RefreshDatabase;

    public function test_command_sends_run_notification_email_with_status_and_slots(): void
    {
        Mail::fake();

        $this->artisan('allowances:process-meals')
            ->assertSuccessful();

        Mail::assertSent(AllowanceCronRunMail::class, function (AllowanceCronRunMail $mail): bool {
            return $mail->hasTo('albertmuhatia@gmail.com')
                && $mail->status === 'success'
                && $mail->grantedCount === 0
                && count($mail->slotResults) === 3
                && collect($mail->slotResults)->pluck('slot')->all() === ['breakfast', 'lunch', 'dinner'];
        });
    }

    public function test_command_uses_env_recipient_override(): void
    {
        Mail::fake();
        putenv('ALLOWANCE_CRON_EMAIL_TO=ops@example.com');

        try {
            $this->artisan('allowances:process-meals')
                ->assertSuccessful();

            Mail::assertSent(AllowanceCronRunMail::class, function (AllowanceCronRunMail $mail): bool {
                return $mail->hasTo('ops@example.com');
            });
        } finally {
            putenv('ALLOWANCE_CRON_EMAIL_TO');
        }
    }
}
