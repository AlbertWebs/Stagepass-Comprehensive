<?php

namespace Tests\Feature;

use App\Mail\AllowanceCronRunMail;
use App\Models\AllowanceType;
use App\Models\Event;
use App\Models\EventUser;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class AllowanceCronEmailTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['app.timezone' => 'Africa/Nairobi']);

        foreach (['Breakfast', 'Lunch', 'Dinner'] as $name) {
            AllowanceType::query()->firstOrCreate(['name' => $name], ['is_active' => true]);
        }
    }

    public function test_command_skips_email_when_no_meals_granted(): void
    {
        Mail::fake();
        Carbon::setTestNow(Carbon::parse('2026-06-30 12:00:00', 'Africa/Nairobi'));

        $this->artisan('allowances:process-meals')
            ->assertSuccessful();

        Mail::assertNothingSent();
    }

    public function test_command_sends_email_when_meals_are_allocated(): void
    {
        Mail::fake();
        Carbon::setTestNow(Carbon::parse('2026-06-30 13:00:00', 'Africa/Nairobi'));

        $event = Event::create([
            'name' => 'Lunch Cron Event',
            'date' => '2026-06-30',
            'start_time' => '06:00',
            'expected_end_time' => '23:00',
            'status' => Event::STATUS_ACTIVE,
        ]);
        $crew = User::factory()->create();
        EventUser::create([
            'event_id' => $event->id,
            'user_id' => $crew->id,
            'checkin_time' => '2026-06-30 08:00:00',
        ]);

        $this->artisan('allowances:process-meals')
            ->assertSuccessful();

        Mail::assertSent(AllowanceCronRunMail::class, function (AllowanceCronRunMail $mail): bool {
            return $mail->hasTo('albertmuhatia@gmail.com')
                && $mail->status === 'success'
                && $mail->grantedCount >= 1
                && count($mail->slotResults) === 3;
        });
    }

    public function test_command_uses_env_recipient_override_when_meals_granted(): void
    {
        Mail::fake();
        Carbon::setTestNow(Carbon::parse('2026-06-30 13:00:00', 'Africa/Nairobi'));
        putenv('ALLOWANCE_CRON_EMAIL_TO=ops@example.com');

        try {
            $event = Event::create([
                'name' => 'Lunch Cron Event Override',
                'date' => '2026-06-30',
                'start_time' => '06:00',
                'expected_end_time' => '23:00',
                'status' => Event::STATUS_ACTIVE,
            ]);
            $crew = User::factory()->create();
            EventUser::create([
                'event_id' => $event->id,
                'user_id' => $crew->id,
                'checkin_time' => '2026-06-30 08:00:00',
            ]);

            $this->artisan('allowances:process-meals')
                ->assertSuccessful();

            Mail::assertSent(AllowanceCronRunMail::class, function (AllowanceCronRunMail $mail): bool {
                return $mail->hasTo('ops@example.com') && $mail->grantedCount >= 1;
            });
        } finally {
            putenv('ALLOWANCE_CRON_EMAIL_TO');
        }
    }
}
