<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class EventCrewApiTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        $token = $user->createToken('test')->plainTextToken;

        return ['Authorization' => 'Bearer '.$token];
    }

    private function attachTeamLeaderRole(User $user): void
    {
        Role::firstOrCreate(['name' => 'team_leader'], ['label' => 'Team Leader']);
        $user->roles()->syncWithoutDetaching([Role::where('name', 'team_leader')->firstOrFail()->id]);
    }

    public function test_team_leader_assigned_on_event_can_assign_crew(): void
    {
        Queue::fake();
        $leader = User::factory()->create();
        $this->attachTeamLeaderRole($leader);
        $crew = User::factory()->create();
        $event = Event::create([
            'name' => 'Gig',
            'date' => now()->addDay()->toDateString(),
            'start_time' => '18:00',
            'team_leader_id' => $leader->id,
            'created_by_id' => $leader->id,
            'status' => Event::STATUS_CREATED,
        ]);

        $response = $this->withHeaders($this->auth($leader))
            ->postJson("/api/events/{$event->id}/assign-user", ['user_id' => $crew->id]);

        $response->assertStatus(201);
        $this->assertTrue($event->fresh()->crew()->whereKey($crew->id)->exists());
    }

    public function test_team_leader_without_team_leader_id_can_assign_when_creator(): void
    {
        Queue::fake();
        $leader = User::factory()->create();
        $this->attachTeamLeaderRole($leader);
        $toAdd = User::factory()->create();
        $event = Event::create([
            'name' => 'Gig',
            'date' => now()->addDay()->toDateString(),
            'start_time' => '18:00',
            'team_leader_id' => null,
            'created_by_id' => $leader->id,
            'status' => Event::STATUS_CREATED,
        ]);
        $event->crew()->attach($leader->id, ['role_in_event' => null]);

        $response = $this->withHeaders($this->auth($leader))
            ->postJson("/api/events/{$event->id}/assign-user", ['user_id' => $toAdd->id]);

        $response->assertStatus(201);
        $this->assertTrue($event->fresh()->crew()->whereKey($toAdd->id)->exists());
    }

    public function test_team_leader_without_team_leader_id_can_assign_when_on_crew(): void
    {
        Queue::fake();
        $leader = User::factory()->create();
        $this->attachTeamLeaderRole($leader);
        $creator = User::factory()->create();
        $toAdd = User::factory()->create();
        $event = Event::create([
            'name' => 'Gig',
            'date' => now()->addDay()->toDateString(),
            'start_time' => '18:00',
            'team_leader_id' => null,
            'created_by_id' => $creator->id,
            'status' => Event::STATUS_CREATED,
        ]);
        $event->crew()->attach($creator->id, ['role_in_event' => null]);
        $event->crew()->attach($leader->id, ['role_in_event' => 'Co-lead']);

        $response = $this->withHeaders($this->auth($leader))
            ->postJson("/api/events/{$event->id}/assign-user", ['user_id' => $toAdd->id]);

        $response->assertStatus(201);
    }

    public function test_team_leader_cannot_assign_when_another_user_is_assigned_leader(): void
    {
        $creator = User::factory()->create();
        $leader = User::factory()->create();
        $this->attachTeamLeaderRole($leader);
        $assigned = User::factory()->create();
        $toAdd = User::factory()->create();
        $event = Event::create([
            'name' => 'Gig',
            'date' => now()->addDay()->toDateString(),
            'start_time' => '18:00',
            'team_leader_id' => $assigned->id,
            'created_by_id' => $creator->id,
            'status' => Event::STATUS_CREATED,
        ]);
        $event->crew()->attach($creator->id, ['role_in_event' => null]);
        $event->crew()->attach($leader->id, ['role_in_event' => null]);

        $response = $this->withHeaders($this->auth($leader))
            ->postJson("/api/events/{$event->id}/assign-user", ['user_id' => $toAdd->id]);

        $response->assertStatus(403);
    }

    public function test_crew_pivot_role_team_leader_can_assign_when_no_official_team_leader_id(): void
    {
        Queue::fake();
        $rosterLeader = User::factory()->create();
        $creator = User::factory()->create();
        $toAdd = User::factory()->create();
        $event = Event::create([
            'name' => 'Gig',
            'date' => now()->addDay()->toDateString(),
            'start_time' => '18:00',
            'team_leader_id' => null,
            'created_by_id' => $creator->id,
            'status' => Event::STATUS_CREATED,
        ]);
        $event->crew()->attach($creator->id, ['role_in_event' => null]);
        $event->crew()->attach($rosterLeader->id, ['role_in_event' => 'Team Leader']);

        $response = $this->withHeaders($this->auth($rosterLeader))
            ->postJson("/api/events/{$event->id}/assign-user", ['user_id' => $toAdd->id]);

        $response->assertStatus(201);
        $this->assertTrue($event->fresh()->crew()->whereKey($toAdd->id)->exists());
    }

    public function test_crew_member_without_team_leader_role_cannot_assign(): void
    {
        $creator = User::factory()->create();
        $crew = User::factory()->create();
        $other = User::factory()->create();
        $event = Event::create([
            'name' => 'Gig',
            'date' => now()->addDay()->toDateString(),
            'start_time' => '18:00',
            'team_leader_id' => null,
            'created_by_id' => $creator->id,
            'status' => Event::STATUS_CREATED,
        ]);
        $event->crew()->attach($creator->id, ['role_in_event' => null]);
        $event->crew()->attach($crew->id, ['role_in_event' => 'Technician']);

        $response = $this->withHeaders($this->auth($crew))
            ->postJson("/api/events/{$event->id}/assign-user", ['user_id' => $other->id]);

        $response->assertStatus(403);
    }
}
