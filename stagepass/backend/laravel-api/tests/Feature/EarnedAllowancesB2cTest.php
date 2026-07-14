<?php

namespace Tests\Feature;

use App\Models\AllowanceType;
use App\Models\Event;
use App\Models\EventAllowance;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EarnedAllowancesB2cTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('test')->plainTextToken];
    }

    public function test_b2c_preview_and_dry_run_process_marks_allowances_paid(): void
    {
        config(['mpesa.dry_run' => true]);

        $admin = User::factory()->create();
        $crew = User::factory()->create(['phone' => '0712345678']);
        $role = Role::firstOrCreate(['name' => 'admin'], ['label' => 'Admin']);
        $admin->roles()->syncWithoutDetaching([$role->id]);

        $event = Event::create([
            'name' => 'B2C Event',
            'date' => now()->toDateString(),
            'start_time' => '10:00',
            'team_leader_id' => $admin->id,
            'created_by_id' => $admin->id,
            'status' => Event::STATUS_ACTIVE,
        ]);
        $event->crew()->attach($crew->id, ['role_in_event' => 'Technician']);
        $type = AllowanceType::create(['name' => 'Lunch', 'is_active' => true]);

        $allowance = EventAllowance::create([
            'event_id' => $event->id,
            'crew_id' => $crew->id,
            'allowance_type_id' => $type->id,
            'amount' => 500,
            'recorded_by' => $admin->id,
            'recorded_at' => now(),
            'status' => EventAllowance::STATUS_APPROVED,
            'approved_by' => $admin->id,
            'approved_at' => now(),
            'source' => EventAllowance::SOURCE_AUTOMATIC,
            'meal_slot' => 'lunch',
        ]);

        $preview = $this->withHeaders($this->auth($admin))
            ->getJson('/api/payments/earned-allowances/b2c-preview?event_id='.$event->id);

        $preview->assertOk()
            ->assertJsonPath('payment_count', 1)
            ->assertJsonPath('eligible.0.user_id', $crew->id)
            ->assertJsonPath('eligible.0.amount', 500)
            ->assertJsonPath('eligible.0.phone', '254712345678');

        $process = $this->withHeaders($this->auth($admin))
            ->postJson('/api/payments/earned-allowances/b2c-process', [
                'event_id' => $event->id,
                'user_ids' => [$crew->id],
                'allowance_ids' => [$allowance->id],
            ]);

        $process->assertOk()
            ->assertJsonPath('dry_run', true)
            ->assertJsonPath('payout.status', 'completed');

        $this->assertDatabaseHas('event_allowances', [
            'id' => $allowance->id,
            'status' => EventAllowance::STATUS_PAID,
        ]);
        $this->assertDatabaseHas('b2c_payout_items', [
            'user_id' => $crew->id,
            'status' => 'completed',
            'phone' => '254712345678',
        ]);
    }

    public function test_b2c_preview_blocks_crew_without_phone(): void
    {
        config(['mpesa.dry_run' => true]);

        $admin = User::factory()->create();
        $crew = User::factory()->create(['phone' => null]);
        $role = Role::firstOrCreate(['name' => 'admin'], ['label' => 'Admin']);
        $admin->roles()->syncWithoutDetaching([$role->id]);

        $event = Event::create([
            'name' => 'No Phone Event',
            'date' => now()->toDateString(),
            'start_time' => '10:00',
            'team_leader_id' => $admin->id,
            'created_by_id' => $admin->id,
            'status' => Event::STATUS_ACTIVE,
        ]);
        $event->crew()->attach($crew->id, ['role_in_event' => 'Technician']);
        $type = AllowanceType::create(['name' => 'Transport', 'is_active' => true]);

        EventAllowance::create([
            'event_id' => $event->id,
            'crew_id' => $crew->id,
            'allowance_type_id' => $type->id,
            'amount' => 200,
            'recorded_by' => $admin->id,
            'recorded_at' => now(),
            'status' => EventAllowance::STATUS_APPROVED,
            'approved_by' => $admin->id,
            'approved_at' => now(),
            'source' => EventAllowance::SOURCE_MANUAL,
        ]);

        $preview = $this->withHeaders($this->auth($admin))
            ->getJson('/api/payments/earned-allowances/b2c-preview?event_id='.$event->id);

        $preview->assertOk()
            ->assertJsonPath('payment_count', 0)
            ->assertJsonPath('blocked_count', 1);
    }
}
