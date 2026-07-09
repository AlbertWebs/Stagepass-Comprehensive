<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\EventAttendanceSession;
use App\Models\EventUser;
use App\Models\Role;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EventCrewTransferTest extends TestCase
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

    public function test_transfer_with_open_checkin_archives_session_on_source(): void
    {
        $leader = User::factory()->create();
        $crew = User::factory()->create();
        $this->attachRole($leader, 'team_leader', 'Team Leader');

        $source = Event::create([
            'name' => 'Source Event',
            'date' => now()->toDateString(),
            'start_time' => '09:00',
            'team_leader_id' => $leader->id,
            'created_by_id' => $leader->id,
            'status' => Event::STATUS_ACTIVE,
        ]);
        $target = Event::create([
            'name' => 'Target Event',
            'date' => now()->toDateString(),
            'start_time' => '14:00',
            'team_leader_id' => $leader->id,
            'created_by_id' => $leader->id,
            'status' => Event::STATUS_ACTIVE,
        ]);

        EventUser::create([
            'event_id' => $source->id,
            'user_id' => $crew->id,
            'checkin_time' => now()->subHours(2),
        ]);

        $this->withHeaders($this->auth($leader))
            ->postJson("/api/events/{$source->id}/transfer-user", [
                'user_id' => $crew->id,
                'target_event_id' => $target->id,
            ])
            ->assertOk();

        $this->assertFalse(
            EventUser::query()->where('event_id', $source->id)->where('user_id', $crew->id)->exists()
        );
        $this->assertTrue(
            EventUser::query()->where('event_id', $target->id)->where('user_id', $crew->id)->exists()
        );
        $this->assertSame(
            1,
            EventAttendanceSession::query()->where('event_id', $source->id)->where('user_id', $crew->id)->count()
        );
    }

    public function test_transfer_rejects_duplicate_on_target(): void
    {
        $leader = User::factory()->create();
        $crew = User::factory()->create();
        $this->attachRole($leader, 'team_leader', 'Team Leader');

        $source = Event::create([
            'name' => 'Source',
            'date' => now()->toDateString(),
            'start_time' => '09:00',
            'team_leader_id' => $leader->id,
            'created_by_id' => $leader->id,
            'status' => Event::STATUS_ACTIVE,
        ]);
        $target = Event::create([
            'name' => 'Target',
            'date' => now()->toDateString(),
            'start_time' => '14:00',
            'team_leader_id' => $leader->id,
            'created_by_id' => $leader->id,
            'status' => Event::STATUS_ACTIVE,
        ]);
        $source->crew()->attach($crew->id);
        $target->crew()->attach($crew->id);

        $this->withHeaders($this->auth($leader))
            ->postJson("/api/events/{$source->id}/transfer-user", [
                'user_id' => $crew->id,
                'target_event_id' => $target->id,
            ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'User is already on the target event crew.');
    }
}
