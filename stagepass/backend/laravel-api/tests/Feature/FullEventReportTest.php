<?php

namespace Tests\Feature;

use App\Models\AllowanceType;
use App\Models\Event;
use App\Models\EventAllowance;
use App\Models\EventExpense;
use App\Models\EventMeal;
use App\Models\EventPayment;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FullEventReportTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('test')->plainTextToken];
    }

    public function test_admin_can_download_full_event_report_with_allowance_breakdown(): void
    {
        $admin = User::factory()->create();
        $crew = User::factory()->create(['name' => 'Crew One']);
        $role = Role::firstOrCreate(['name' => 'admin'], ['label' => 'Admin']);
        $admin->roles()->syncWithoutDetaching([$role->id]);

        $event = Event::create([
            'name' => 'Full Report Event',
            'date' => now()->toDateString(),
            'start_time' => '09:00',
            'location_name' => 'Nairobi Arena',
            'team_leader_id' => $admin->id,
            'created_by_id' => $admin->id,
            'status' => Event::STATUS_ACTIVE,
            'daily_allowance' => 1500,
            'per_diem_enabled' => true,
        ]);
        $event->crew()->attach($crew->id, ['role_in_event' => 'Technician']);

        $type = AllowanceType::create(['name' => 'Transport Allowance', 'is_active' => true]);
        EventAllowance::create([
            'event_id' => $event->id,
            'crew_id' => $crew->id,
            'allowance_type_id' => $type->id,
            'amount' => 800,
            'description' => 'Late return taxi',
            'recorded_by' => $admin->id,
            'recorded_at' => now(),
            'status' => EventAllowance::STATUS_APPROVED,
            'source' => EventAllowance::SOURCE_MANUAL,
            'approved_by' => $admin->id,
            'approved_at' => now(),
        ]);

        EventPayment::create([
            'event_id' => $event->id,
            'user_id' => $crew->id,
            'payment_date' => now()->toDateString(),
            'purpose' => 'fair',
            'hours' => 8,
            'allowances' => 800,
            'per_diem' => 1500,
            'total_amount' => 2300,
            'status' => EventPayment::STATUS_APPROVED,
        ]);

        EventExpense::create([
            'event_id' => $event->id,
            'user_id' => $crew->id,
            'used_company_transport' => false,
            'cab_amount' => 400,
            'parking_fee' => 100,
        ]);

        $json = $this->withHeaders($this->auth($admin))
            ->getJson('/api/reports/full-event?event_id='.$event->id.'&date_from='.$event->date->format('Y-m-d').'&date_to='.$event->date->format('Y-m-d'));

        $json->assertOk()
            ->assertJsonPath('summary.events_count', 1)
            ->assertJsonPath('summary.earned_allowances_total', 800)
            ->assertJsonPath('events.0.event.name', 'Full Report Event')
            ->assertJsonPath('events.0.earned_allowances.0.allowance_type', 'Transport Allowance')
            ->assertJsonPath('events.0.earned_allowances.0.amount', 800)
            ->assertJsonPath('events.0.payments.0.allowances', 800)
            ->assertJsonPath('events.0.payments.0.per_diem', 1500)
            ->assertJsonPath('events.0.expenses.0.cab_amount', 400);

        $export = $this->withHeaders($this->auth($admin))
            ->getJson('/api/reports/export?type=full-event&format=json&event_id='.$event->id.'&date_from='.$event->date->format('Y-m-d').'&date_to='.$event->date->format('Y-m-d'));

        $export->assertOk()
            ->assertJsonPath('title', 'Full Event Report');
        $this->assertStringContainsString('Transport Allowance', (string) $export->json('html'));
        $this->assertStringContainsString('Late return taxi', (string) $export->json('html'));
        $this->assertStringContainsString('Earned allowances (full breakdown)', (string) $export->json('html'));
        $this->assertStringContainsString('Project lead sign-off', (string) $export->json('html'));
        $this->assertStringContainsString('Project lead signature', (string) $export->json('html'));
    }

    public function test_crew_register_shows_transport_total_once_per_person(): void
    {
        $admin = User::factory()->create();
        $crew = User::factory()->create(['name' => 'Multi Day Crew']);
        $role = Role::firstOrCreate(['name' => 'admin'], ['label' => 'Admin']);
        $admin->roles()->syncWithoutDetaching([$role->id]);

        $event = Event::create([
            'name' => 'Multi Day Event',
            'date' => '2026-07-17',
            'end_date' => '2026-07-18',
            'start_time' => '09:00',
            'location_name' => 'Nairobi Arena',
            'team_leader_id' => $admin->id,
            'created_by_id' => $admin->id,
            'status' => Event::STATUS_ACTIVE,
        ]);
        $event->crew()->attach($crew->id, [
            'role_in_event' => 'Technician',
            'transport_type' => 'cab',
            'transport_amount' => 800,
        ]);

        foreach (['2026-07-17', '2026-07-18'] as $workDate) {
            EventMeal::create([
                'event_id' => $event->id,
                'user_id' => $crew->id,
                'work_date' => $workDate,
            ]);
        }

        $response = $this->withHeaders($this->auth($admin))
            ->getJson('/api/reports/full-event?event_id='.$event->id.'&date_from=2026-07-17&date_to=2026-07-18');

        $response->assertOk();

        $rows = collect($response->json('events.0.crew_register'))
            ->where('user_id', $crew->id)
            ->values();

        $this->assertCount(2, $rows);
        $this->assertSame(800, $rows->first()['fare_total']);
        $this->assertNull($rows->last()['fare_total']);
        $this->assertSame(800.0, $rows->sum(fn (array $row) => (float) ($row['fare_total'] ?? 0)));
    }
}
