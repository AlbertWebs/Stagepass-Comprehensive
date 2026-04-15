<?php

namespace Tests\Feature;

use App\Models\AllowanceType;
use App\Models\Event;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EarnedAllowancesApiTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        return ['Authorization' => 'Bearer ' . $user->createToken('test')->plainTextToken];
    }

    public function test_admin_can_create_and_list_earned_allowances(): void
    {
        $admin = User::factory()->create();
        $crew = User::factory()->create();
        $role = Role::firstOrCreate(['name' => 'admin'], ['label' => 'Admin']);
        $admin->roles()->syncWithoutDetaching([$role->id]);

        $event = Event::create([
            'name' => 'Allowances Event',
            'date' => now()->toDateString(),
            'start_time' => '10:00',
            'team_leader_id' => $admin->id,
            'created_by_id' => $admin->id,
            'status' => Event::STATUS_ACTIVE,
        ]);
        $event->crew()->attach($crew->id, ['role_in_event' => 'Technician']);
        $type = AllowanceType::create(['name' => 'Transport Allowance', 'is_active' => true]);

        $created = $this->withHeaders($this->auth($admin))
            ->postJson('/api/payments/earned-allowances', [
                'event_id' => $event->id,
                'crew_id' => $crew->id,
                'allowance_type_id' => $type->id,
                'amount' => 800,
                'description' => 'Late return',
            ]);

        $created->assertStatus(201)
            ->assertJsonPath('status', 'pending');

        $list = $this->withHeaders($this->auth($admin))
            ->getJson('/api/payments/earned-allowances');

        $list->assertOk()
            ->assertJsonPath('data.0.event_id', $event->id)
            ->assertJsonPath('data.0.total_allowances', 800);
    }

}
