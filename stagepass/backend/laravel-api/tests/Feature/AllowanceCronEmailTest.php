<?php

namespace Tests\Feature;

use App\Mail\AllowanceCronRunMail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class AllowanceCronEmailTest extends TestCase
{
    use RefreshDatabase;

    public function test_command_sends_run_notification_email(): void
    {
        Mail::fake();

        $this->artisan('allowances:process-meals')
            ->assertSuccessful();

        Mail::assertSent(AllowanceCronRunMail::class, function (AllowanceCronRunMail $mail): bool {
            return $mail->hasTo('albertmuhatia@gmail.com');
        });
    }

    public function test_command_skips_email_when_disabled(): void
    {
        Mail::fake();
        putenv('ALLOWANCE_CRON_EMAIL_ENABLED=false');

        $this->artisan('allowances:process-meals')
            ->assertSuccessful();

        Mail::assertNothingSent();
    }
}
