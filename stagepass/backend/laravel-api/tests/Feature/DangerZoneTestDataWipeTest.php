<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\Role;
use App\Models\User;
use App\Services\TestDataWiper;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DangerZoneTestDataWipeTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        $token = $user->createToken('test')->plainTextToken;

        return ['Authorization' => 'Bearer '.$token];
    }

    private function adminUser(): User
    {
        $admin = User::factory()->create();
        $role = Role::firstOrCreate(['name' => 'admin'], ['label' => 'Admin']);
        $admin->roles()->syncWithoutDetaching([$role->id]);

        return $admin;
    }

    public function test_admin_can_wipe_events_scope_only(): void
    {
        $admin = $this->adminUser();
        $crew = User::factory()->create();

        Event::create([
            'name' => 'Test Event',
            'date' => now()->toDateString(),
            'start_time' => '09:00',
            'created_by_id' => $admin->id,
            'status' => Event::STATUS_CREATED,
        ]);

        $response = $this->withHeaders($this->auth($admin))
            ->postJson('/api/danger-zone/wipe-test-data', [
                'scopes' => ['events'],
                'confirm' => TestDataWiper::CONFIRM_PHRASE,
            ]);

        $response->assertOk()
            ->assertJsonPath('deleted_users', 0)
            ->assertJsonFragment(['scopes' => ['events']]);

        $this->assertDatabaseCount('events', 0);
        $this->assertDatabaseHas('users', ['id' => $admin->id]);
        $this->assertDatabaseHas('users', ['id' => $crew->id]);
    }

    public function test_admin_can_wipe_users_scope_and_keeps_admin_accounts(): void
    {
        $admin = $this->adminUser();
        $crew = User::factory()->create();

        $response = $this->withHeaders($this->auth($admin))
            ->postJson('/api/danger-zone/wipe-test-data', [
                'scopes' => ['users'],
                'confirm' => TestDataWiper::CONFIRM_PHRASE,
            ]);

        $response->assertOk()
            ->assertJsonPath('deleted_users', 1);

        $this->assertDatabaseHas('users', ['id' => $admin->id]);
        $this->assertDatabaseMissing('users', ['id' => $crew->id]);
    }

    public function test_all_scope_wipes_events_operational_and_users(): void
    {
        $admin = $this->adminUser();
        User::factory()->create();

        Event::create([
            'name' => 'Test Event',
            'date' => now()->toDateString(),
            'start_time' => '09:00',
            'created_by_id' => $admin->id,
            'status' => Event::STATUS_CREATED,
        ]);

        $response = $this->withHeaders($this->auth($admin))
            ->postJson('/api/danger-zone/wipe-test-data', [
                'scopes' => ['all'],
                'confirm' => TestDataWiper::CONFIRM_PHRASE,
            ]);

        $response->assertOk()
            ->assertJsonPath('deleted_users', 1);

        $this->assertDatabaseCount('events', 0);
        $this->assertDatabaseHas('users', ['id' => $admin->id]);
    }

    public function test_requires_matching_confirmation_phrase(): void
    {
        $admin = $this->adminUser();

        $this->withHeaders($this->auth($admin))
            ->postJson('/api/danger-zone/wipe-test-data', [
                'scopes' => ['events'],
                'confirm' => 'WRONG',
            ])
            ->assertStatus(422);

        $this->assertDatabaseCount('users', 1);
    }

    public function test_non_admin_cannot_wipe_test_data(): void
    {
        $user = User::factory()->create();

        Event::create([
            'name' => 'Protected Event',
            'date' => now()->toDateString(),
            'start_time' => '09:00',
            'created_by_id' => $user->id,
            'status' => Event::STATUS_CREATED,
        ]);

        $this->withHeaders($this->auth($user))
            ->postJson('/api/danger-zone/wipe-test-data', [
                'scopes' => ['events'],
                'confirm' => TestDataWiper::CONFIRM_PHRASE,
            ])
            ->assertForbidden();

        $this->assertDatabaseCount('events', 1);
    }
}
