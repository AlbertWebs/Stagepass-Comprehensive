<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\EventUser;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AttendanceApiTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        $token = $user->createToken('test')->plainTextToken;
        return ['Authorization' => 'Bearer ' . $token];
    }

    public function test_attendance_stats_returns_structure(): void
    {
        $user = User::factory()->create();
        $response = $this->withHeaders($this->auth($user))
            ->getJson('/api/attendance/stats');
        $response->assertStatus(200)
            ->assertJsonStructure([
                'total_assigned',
                'checked_in',
                'missed',
                'attendance_percentage',
                'office_checkins_last_30',
                'expected_office_weekdays',
                'pull_up_percentage',
                'office_streak_percentage',
                'events_streak_percentage',
            ]);
    }

    public function test_checkin_succeeds_when_within_geofence(): void
    {
        $user = User::factory()->create();
        $event = Event::create([
            'name' => 'Geo Event',
            'date' => now()->toDateString(),
            'start_time' => '09:00',
            'latitude' => -1.2921,
            'longitude' => 36.8219,
            'geofence_radius' => 500,
            'created_by_id' => $user->id,
            'status' => Event::STATUS_ACTIVE,
        ]);
        $event->crew()->attach($user->id, ['role_in_event' => null]);

        $response = $this->withHeaders($this->auth($user))
            ->postJson('/api/attendance/checkin', [
                'event_id' => $event->id,
                'latitude' => -1.2921,
                'longitude' => 36.8219,
            ]);
        $response->assertStatus(200)->assertJson(['message' => 'Checked in successfully']);
        $assignment = EventUser::where('event_id', $event->id)->where('user_id', $user->id)->first();
        $this->assertNotNull($assignment->checkin_time);
    }

    public function test_checkin_rejects_when_already_checked_in(): void
    {
        $user = User::factory()->create();
        $event = Event::create([
            'name' => 'Geo Event',
            'date' => now()->toDateString(),
            'start_time' => '09:00',
            'latitude' => -1.2921,
            'longitude' => 36.8219,
            'geofence_radius' => 500,
            'created_by_id' => $user->id,
            'status' => Event::STATUS_ACTIVE,
        ]);
        $event->crew()->attach($user->id, ['role_in_event' => null]);
        EventUser::where('event_id', $event->id)->where('user_id', $user->id)->update(['checkin_time' => now()]);

        $response = $this->withHeaders($this->auth($user))
            ->postJson('/api/attendance/checkin', [
                'event_id' => $event->id,
                'latitude' => -1.2921,
                'longitude' => 36.8219,
            ]);
        $response->assertStatus(422)->assertJsonFragment(['message' => 'Already checked in']);
    }

    public function test_office_checkin_rejects_on_weekend_with_default_weekday_policy(): void
    {
        $user = User::factory()->create();
        Carbon::setTestNow(Carbon::parse('2026-04-11 10:00:00', 'Africa/Nairobi')); // Saturday

        $this->withHeaders($this->auth($user))
            ->postJson('/api/attendance/office-checkin', ['latitude' => -1.286389, 'longitude' => 36.817223])
            ->assertStatus(422)
            ->assertJsonFragment(['message' => 'Office check-in is not required today.']);

        Carbon::setTestNow();
    }
}
