<?php

namespace Tests\Feature;

use App\Models\AllowanceType;
use App\Models\Event;
use App\Models\EventAllowance;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
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

    public function test_crew_can_submit_manual_allowance_request_with_receipt(): void
    {
        Notification::fake();
        Storage::fake('public');

        $leader = User::factory()->create();
        $crew = User::factory()->create();
        Role::firstOrCreate(['name' => 'team_leader'], ['label' => 'Team Leader']);
        $leader->roles()->syncWithoutDetaching([Role::where('name', 'team_leader')->firstOrFail()->id]);

        $event = Event::create([
            'name' => 'Field Event',
            'date' => now()->toDateString(),
            'start_time' => '10:00',
            'team_leader_id' => $leader->id,
            'created_by_id' => $leader->id,
            'status' => Event::STATUS_ACTIVE,
        ]);
        $event->crew()->attach($crew->id, ['role_in_event' => 'Technician']);

        $taxi = AllowanceType::firstOrCreate(['name' => 'Taxi'], ['is_active' => true]);

        $file = UploadedFile::fake()->image('receipt.jpg', 400, 400);

        $res = $this->withHeaders($this->auth($crew))
            ->post('/api/payments/allowance-requests', [
                'event_id' => $event->id,
                'allowance_type_id' => $taxi->id,
                'amount' => 350,
                'reason' => 'Taxi fare',
                'attachment' => $file,
            ]);

        $res->assertStatus(201)
            ->assertJsonPath('message', 'Allowance request submitted successfully. Waiting for team leader approval.');

        $this->assertDatabaseHas('event_allowances', [
            'event_id' => $event->id,
            'crew_id' => $crew->id,
            'status' => EventAllowance::STATUS_PENDING,
            'source' => EventAllowance::SOURCE_MANUAL,
        ]);

        Notification::assertSentTo($leader, \App\Notifications\AllowanceRequestSubmittedNotification::class);
    }

    public function test_team_leader_can_approve_manual_allowance_and_crew_sees_status(): void
    {
        Notification::fake();

        $leader = User::factory()->create();
        $crew = User::factory()->create();
        Role::firstOrCreate(['name' => 'team_leader'], ['label' => 'Team Leader']);
        $leader->roles()->syncWithoutDetaching([Role::where('name', 'team_leader')->firstOrFail()->id]);

        $event = Event::create([
            'name' => 'Approve Event',
            'date' => now()->toDateString(),
            'start_time' => '10:00',
            'team_leader_id' => $leader->id,
            'created_by_id' => $leader->id,
            'status' => Event::STATUS_ACTIVE,
        ]);
        $event->crew()->attach($crew->id, ['role_in_event' => 'Technician']);

        $taxi = AllowanceType::firstOrCreate(['name' => 'Taxi'], ['is_active' => true]);

        $allowance = EventAllowance::create([
            'event_id' => $event->id,
            'crew_id' => $crew->id,
            'allowance_type_id' => $taxi->id,
            'amount' => 200,
            'description' => 'Need taxi',
            'recorded_by' => $crew->id,
            'recorded_at' => now(),
            'status' => EventAllowance::STATUS_PENDING,
            'source' => EventAllowance::SOURCE_MANUAL,
            'attachment_path' => 'allowance-receipts/test.jpg',
        ]);

        $approve = $this->withHeaders($this->auth($leader))
            ->postJson('/api/payments/earned-allowances/' . $allowance->id . '/status', [
                'status' => 'approved',
                'comment' => 'OK',
            ]);

        $approve->assertOk()->assertJsonPath('status', 'approved');

        Notification::assertSentTo($crew, \App\Notifications\AllowanceRequestDecisionNotification::class);

        $crewList = $this->withHeaders($this->auth($crew))
            ->getJson('/api/payments/earned-allowances');
        $crewList->assertOk();
        $flat = $crewList->json('flat');
        $this->assertIsArray($flat);
        $this->assertTrue(collect($flat)->contains(fn ($row) => ($row['id'] ?? null) === $allowance->id && ($row['status'] ?? '') === 'approved'));
    }

    public function test_reject_requires_comment(): void
    {
        $leader = User::factory()->create();
        $crew = User::factory()->create();
        Role::firstOrCreate(['name' => 'team_leader'], ['label' => 'Team Leader']);
        $leader->roles()->syncWithoutDetaching([Role::where('name', 'team_leader')->firstOrFail()->id]);

        $event = Event::create([
            'name' => 'Reject Event',
            'date' => now()->toDateString(),
            'start_time' => '10:00',
            'team_leader_id' => $leader->id,
            'created_by_id' => $leader->id,
            'status' => Event::STATUS_ACTIVE,
        ]);
        $event->crew()->attach($crew->id, ['role_in_event' => 'Technician']);

        $taxi = AllowanceType::firstOrCreate(['name' => 'Taxi'], ['is_active' => true]);

        $allowance = EventAllowance::create([
            'event_id' => $event->id,
            'crew_id' => $crew->id,
            'allowance_type_id' => $taxi->id,
            'amount' => 100,
            'description' => 'x',
            'recorded_by' => $crew->id,
            'recorded_at' => now(),
            'status' => EventAllowance::STATUS_PENDING,
            'source' => EventAllowance::SOURCE_MANUAL,
        ]);

        $this->withHeaders($this->auth($leader))
            ->postJson('/api/payments/earned-allowances/' . $allowance->id . '/status', [
                'status' => 'rejected',
            ])
            ->assertStatus(422);
    }

}
