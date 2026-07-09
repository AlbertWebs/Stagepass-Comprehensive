<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\EventUser;
use App\Models\Role;
use App\Models\User;
use App\Support\EventAttendanceEligibility;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TeamLeadOperationalControlsTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        return ['Authorization' => 'Bearer ' . $user->createToken('test')->plainTextToken];
    }

    private function attachRole(User $user, string $name, string $label): void
    {
        $role = Role::firstOrCreate(['name' => $name], ['label' => $label]);
        $user->roles()->syncWithoutDetaching([$role->id]);
    }

    public function test_team_lead_can_pause_resume_and_record_transport(): void
    {
        $leader = User::factory()->create();
        $crew = User::factory()->create();
        $this->attachRole($leader, 'team_leader', 'Team Leader');
        $event = Event::create([
            'name' => 'Ops Event',
            'date' => now()->toDateString(),
            'start_time' => '09:00',
            'team_leader_id' => $leader->id,
            'created_by_id' => $leader->id,
            'status' => Event::STATUS_ACTIVE,
        ]);
        EventUser::create([
            'event_id' => $event->id,
            'user_id' => $crew->id,
            'checkin_time' => now()->subHour(),
        ]);

        $this->withHeaders($this->auth($leader))
            ->postJson("/api/events/{$event->id}/crew/{$crew->id}/pause", ['reason' => 'Break'])
            ->assertOk()
            ->assertJsonPath('message', 'Crew paused successfully');

        Carbon::setTestNow(now()->addMinutes(20));
        $this->withHeaders($this->auth($leader))
            ->postJson("/api/events/{$event->id}/crew/{$crew->id}/resume")
            ->assertOk()
            ->assertJsonPath('message', 'Crew resumed successfully');

        $this->withHeaders($this->auth($leader))
            ->postJson("/api/events/{$event->id}/crew/{$crew->id}/transport", [
                'transport_type' => 'cab',
                'transport_amount' => 800,
            ])
            ->assertOk()
            ->assertJsonPath('message', 'Transport recorded successfully');
    }

    public function test_regular_crew_cannot_pause_or_close_event(): void
    {
        $leader = User::factory()->create();
        $crew = User::factory()->create();
        $this->attachRole($leader, 'team_leader', 'Team Leader');
        $event = Event::create([
            'name' => 'Ops Event',
            'date' => now()->toDateString(),
            'start_time' => '09:00',
            'team_leader_id' => $leader->id,
            'created_by_id' => $leader->id,
            'status' => Event::STATUS_ACTIVE,
        ]);
        EventUser::create([
            'event_id' => $event->id,
            'user_id' => $crew->id,
            'checkin_time' => now()->subHour(),
        ]);

        $this->withHeaders($this->auth($crew))
            ->postJson("/api/events/{$event->id}/crew/{$crew->id}/pause")
            ->assertStatus(403);

        $this->withHeaders($this->auth($crew))
            ->postJson("/api/events/{$event->id}/done-for-day", ['closing_comment' => 'Done'])
            ->assertStatus(403);
    }

    public function test_done_for_day_requires_comment_and_cannot_repeat(): void
    {
        $leader = User::factory()->create();
        $this->attachRole($leader, 'team_leader', 'Team Leader');
        $event = Event::create([
            'name' => 'Ops Event',
            'date' => now()->toDateString(),
            'start_time' => '09:00',
            'team_leader_id' => $leader->id,
            'created_by_id' => $leader->id,
            'status' => Event::STATUS_ACTIVE,
        ]);

        $this->withHeaders($this->auth($leader))
            ->postJson("/api/events/{$event->id}/done-for-day", ['closing_comment' => ''])
            ->assertStatus(422);

        $this->withHeaders($this->auth($leader))
            ->postJson("/api/events/{$event->id}/done-for-day", ['closing_comment' => 'All tasks complete'])
            ->assertOk()
            ->assertJsonPath('status', Event::STATUS_DONE_FOR_DAY);

        $this->withHeaders($this->auth($leader))
            ->postJson("/api/events/{$event->id}/done-for-day", ['closing_comment' => 'Duplicate'])
            ->assertStatus(422);
    }

    public function test_done_for_day_checks_out_all_open_crew(): void
    {
        $leader = User::factory()->create();
        $crew1 = User::factory()->create();
        $crew2 = User::factory()->create();
        $this->attachRole($leader, 'team_leader', 'Team Leader');
        $event = Event::create([
            'name' => 'Mass Checkout Event',
            'date' => now()->toDateString(),
            'start_time' => '09:00',
            'team_leader_id' => $leader->id,
            'created_by_id' => $leader->id,
            'status' => Event::STATUS_ACTIVE,
        ]);
        EventUser::create([
            'event_id' => $event->id,
            'user_id' => $leader->id,
            'checkin_time' => now()->subHours(2),
        ]);
        EventUser::create([
            'event_id' => $event->id,
            'user_id' => $crew1->id,
            'checkin_time' => now()->subHours(3),
        ]);
        EventUser::create([
            'event_id' => $event->id,
            'user_id' => $crew2->id,
            'checkin_time' => now()->subHours(1),
        ]);

        $this->withHeaders($this->auth($leader))
            ->postJson("/api/events/{$event->id}/done-for-day", ['closing_comment' => 'Wrapping up'])
            ->assertOk()
            ->assertJsonPath('crew_checked_out', 3)
            ->assertJsonPath('status', Event::STATUS_DONE_FOR_DAY);

        $this->assertDatabaseMissing('event_user', [
            'event_id' => $event->id,
            'user_id' => $crew1->id,
            'checkout_time' => null,
        ]);
    }

    public function test_multi_day_event_reopens_and_allows_checkin_after_done_for_day(): void
    {
        $leader = User::factory()->create();
        $crew = User::factory()->create();
        $this->attachRole($leader, 'team_leader', 'Team Leader');
        $today = Carbon::today()->toDateString();
        $tomorrow = Carbon::today()->copy()->addDay()->toDateString();
        $event = Event::create([
            'name' => 'Multi-day Event',
            'date' => $today,
            'end_date' => $tomorrow,
            'start_time' => '09:00',
            'expected_end_time' => '18:00',
            'latitude' => -1.2921,
            'longitude' => 36.8219,
            'geofence_radius' => 500,
            'team_leader_id' => $leader->id,
            'created_by_id' => $leader->id,
            'status' => Event::STATUS_ACTIVE,
        ]);
        $event->crew()->attach($crew->id, [
            'role_in_event' => 'Tech',
            'checkin_time' => now()->subHours(2),
        ]);

        $this->withHeaders($this->auth($leader))
            ->postJson("/api/events/{$event->id}/done-for-day", ['closing_comment' => 'Day one complete'])
            ->assertOk()
            ->assertJsonPath('crew_checked_out', 1);

        Carbon::setTestNow(Carbon::parse($tomorrow, config('app.timezone'))->setTime(9, 30));

        $this->assertNotNull(
            EventUser::where('event_id', $event->id)->where('user_id', $crew->id)->first(),
            'Crew assignment should remain after done-for-day checkout'
        );

        $event->refresh();
        EventAttendanceEligibility::reopenIfNewAttendanceDay($event, Carbon::now());
        $event->refresh();
        $this->assertSame(Event::STATUS_ACTIVE, $event->status);

        $this->withHeaders($this->auth($leader))
            ->postJson("/api/events/{$event->id}/attendance/manual-checkin/{$crew->id}")
            ->assertOk();

        $assignment = EventUser::where('event_id', $event->id)->where('user_id', $crew->id)->first();
        $this->assertNotNull($assignment?->checkin_time);
    }
}
