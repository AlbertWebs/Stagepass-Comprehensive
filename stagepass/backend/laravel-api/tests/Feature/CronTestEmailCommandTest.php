<?php

namespace Tests\Feature;

use App\Mail\CronHeartbeatMail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class CronTestEmailCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_command_sends_heartbeat_email(): void
    {
        Mail::fake();

        $this->artisan('cron:send-test-email', ['--to' => 'albertmuhatia@gmail.com'])
            ->assertSuccessful();

        Mail::assertSent(CronHeartbeatMail::class, function (CronHeartbeatMail $mail): bool {
            return $mail->hasTo('albertmuhatia@gmail.com');
        });
    }

    public function test_command_rejects_invalid_email(): void
    {
        Mail::fake();

        $this->artisan('cron:send-test-email', ['--to' => 'not-an-email'])
            ->assertFailed();

        Mail::assertNothingSent();
    }
}
