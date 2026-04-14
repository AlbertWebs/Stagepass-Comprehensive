<?php

namespace Tests\Feature;

use App\Models\Holiday;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AttendanceOvertimeTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        $token = $user->createToken('test')->plainTextToken;

        return ['Authorization' => 'Bearer ' . $token];
    }

    public function test_office_checkout_tracks_extra_hours_after_eight_hours(): void
    {
        $user = User::factory()->create();
        Carbon::setTestNow(Carbon::parse('2026-04-13 08:00:00', 'Africa/Nairobi')); // Monday

        $checkin = $this->withHeaders($this->auth($user))
            ->postJson('/api/attendance/office-checkin', ['latitude' => -1.286389, 'longitude' => 36.817223]);
        $checkin->assertOk();

        Carbon::setTestNow(Carbon::parse('2026-04-13 18:00:00', 'Africa/Nairobi'));
        $checkout = $this->withHeaders($this->auth($user))
            ->postJson('/api/attendance/office-checkout');

        $checkout->assertOk()
            ->assertJsonPath('total_hours', 10)
            ->assertJsonPath('extra_hours', 2)
            ->assertJsonPath('day_type', 'normal');
    }

    public function test_sunday_marks_all_hours_as_extra(): void
    {
        $user = User::factory()->create();
        Carbon::setTestNow(Carbon::parse('2026-04-12 09:00:00', 'Africa/Nairobi')); // Sunday

        $this->withHeaders($this->auth($user))
            ->postJson('/api/attendance/office-checkin', ['latitude' => -1.286389, 'longitude' => 36.817223])
            ->assertOk();

        Carbon::setTestNow(Carbon::parse('2026-04-12 15:00:00', 'Africa/Nairobi'));
        $checkout = $this->withHeaders($this->auth($user))
            ->postJson('/api/attendance/office-checkout');

        $checkout->assertOk()
            ->assertJsonPath('total_hours', 6)
            ->assertJsonPath('extra_hours', 6)
            ->assertJsonPath('is_sunday', true)
            ->assertJsonPath('day_type', 'sunday');
    }

    public function test_holiday_marks_all_hours_as_extra(): void
    {
        $user = User::factory()->create();
        Holiday::create([
            'name' => 'Labour Day',
            'date' => '2026-05-01',
            'is_active' => true,
        ]);

        Carbon::setTestNow(Carbon::parse('2026-05-01 10:00:00', 'Africa/Nairobi'));
        $this->withHeaders($this->auth($user))
            ->postJson('/api/attendance/office-checkin', ['latitude' => -1.286389, 'longitude' => 36.817223])
            ->assertOk();

        Carbon::setTestNow(Carbon::parse('2026-05-01 13:30:00', 'Africa/Nairobi'));
        $checkout = $this->withHeaders($this->auth($user))
            ->postJson('/api/attendance/office-checkout');

        $checkout->assertOk()
            ->assertJsonPath('extra_hours', 3.5)
            ->assertJsonPath('is_holiday', true)
            ->assertJsonPath('holiday_name', 'Labour Day')
            ->assertJsonPath('day_type', 'holiday');
    }

    public function test_me_endpoint_returns_live_extra_hours_for_open_session(): void
    {
        $user = User::factory()->create();
        Carbon::setTestNow(Carbon::parse('2026-04-14 08:00:00', 'Africa/Nairobi'));
        $this->withHeaders($this->auth($user))
            ->postJson('/api/attendance/office-checkin', ['latitude' => -1.286389, 'longitude' => 36.817223])
            ->assertOk();

        Carbon::setTestNow(Carbon::parse('2026-04-14 17:15:00', 'Africa/Nairobi'));
        $me = $this->withHeaders($this->auth($user))->getJson('/api/me');

        $me->assertOk()
            ->assertJsonPath('office_total_hours', 9.25)
            ->assertJsonPath('office_extra_hours', 1.25);
    }
}
