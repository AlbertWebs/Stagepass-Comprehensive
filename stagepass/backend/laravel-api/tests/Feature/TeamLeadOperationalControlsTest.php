<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\EventUser;
use App\Models\Role;
use App\Models\User;
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
}
