<?php

namespace Tests\Feature;

use App\Models\AllowanceType;
use App\Models\Event;
use App\Models\EventAllowance;
use App\Models\EventAttendanceSession;
use App\Models\EventMeal;
use App\Models\EventPayment;
use App\Models\EventUser;
use App\Models\Role;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EventDateAdjustmentTest extends TestCase
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

    public function test_shifting_event_date_moves_work_dates(): void
    {
        $admin = User::factory()->create();
        $crew = User::factory()->create();
        $this->attachRole($admin, 'admin', 'Admin');

        $start = Carbon::parse('2026-07-01');
        $event = Event::create([
            'name' => 'Shift Test',
            'date' => $start->toDateString(),
            'end_date' => $start->copy()->addDays(2)->toDateString(),
            'start_time' => '09:00',
            'team_leader_id' => $admin->id,
            'created_by_id' => $admin->id,
            'status' => Event::STATUS_ACTIVE,
        ]);

        EventAttendanceSession::create([
            'event_id' => $event->id,
            'user_id' => $crew->id,
            'work_date' => '2026-07-02',
            'checkin_time' => '2026-07-02 09:00:00',
            'checkout_time' => '2026-07-02 17:00:00',
            'total_hours' => 8,
            'standard_hours' => 8,
            'extra_hours' => 0,
        ]);

        EventMeal::create([
            'event_id' => $event->id,
            'user_id' => $crew->id,
            'work_date' => '2026-07-02',
            'breakfast' => true,
            'lunch' => false,
            'dinner' => false,
        ]);

        $type = AllowanceType::create(['name' => 'Meal', 'is_active' => true]);
        EventAllowance::create([
            'event_id' => $event->id,
            'crew_id' => $crew->id,
            'allowance_type_id' => $type->id,
            'amount' => 500,
            'recorded_by' => $admin->id,
            'recorded_at' => now(),
            'status' => EventAllowance::STATUS_APPROVED,
            'source' => EventAllowance::SOURCE_AUTOMATIC,
            'meal_grant_date' => '2026-07-02',
        ]);

        EventPayment::create([
            'event_id' => $event->id,
            'user_id' => $crew->id,
            'payment_date' => '2026-07-01',
            'total_amount' => 1000,
            'status' => EventPayment::STATUS_PENDING,
        ]);

        $this->withHeaders($this->auth($admin))
            ->putJson("/api/events/{$event->id}", [
                'date' => '2026-07-02',
                'end_date' => '2026-07-04',
                'confirm_date_adjustment' => true,
            ])
            ->assertOk()
            ->assertJsonPath('date_adjustment.attendance_sessions_shifted', 1)
            ->assertJsonPath('date_adjustment.meals_shifted', 1)
            ->assertJsonPath('date_adjustment.allowances_shifted', 1)
            ->assertJsonPath('date_adjustment.payments_shifted', 1);

        $this->assertSame(
            '2026-07-03',
            Carbon::parse(EventAttendanceSession::query()->where('event_id', $event->id)->value('work_date'))->format('Y-m-d')
        );
        $this->assertSame(
            '2026-07-03',
            Carbon::parse(EventMeal::query()->where('event_id', $event->id)->value('work_date'))->format('Y-m-d')
        );
        $this->assertSame(
            '2026-07-03',
            Carbon::parse(EventAllowance::query()->where('event_id', $event->id)->value('meal_grant_date'))->format('Y-m-d')
        );
        $this->assertSame(
            '2026-07-02',
            Carbon::parse(EventPayment::query()->where('event_id', $event->id)->value('payment_date'))->format('Y-m-d')
        );
    }

    public function test_shrinking_range_archives_out_of_span_open_checkins(): void
    {
        $admin = User::factory()->create();
        $crew = User::factory()->create();
        $this->attachRole($admin, 'admin', 'Admin');

        $event = Event::create([
            'name' => 'Shrink Test',
            'date' => '2026-07-01',
            'end_date' => '2026-07-03',
            'start_time' => '09:00',
            'team_leader_id' => $admin->id,
            'created_by_id' => $admin->id,
            'status' => Event::STATUS_ACTIVE,
        ]);

        EventUser::create([
            'event_id' => $event->id,
            'user_id' => $crew->id,
            'checkin_time' => Carbon::parse('2026-07-03 10:00:00'),
        ]);

        $this->withHeaders($this->auth($admin))
            ->putJson("/api/events/{$event->id}", [
                'end_date' => '2026-07-02',
                'confirm_date_adjustment' => true,
            ])
            ->assertOk()
            ->assertJsonPath('date_adjustment.open_checkins_closed', 1);

        $assignment = EventUser::query()->where('event_id', $event->id)->where('user_id', $crew->id)->first();
        $this->assertNotNull($assignment);
        $this->assertSame(
            1,
            EventAttendanceSession::query()->where('event_id', $event->id)->where('user_id', $crew->id)->count()
        );
        $this->assertNull($assignment->checkin_time);
    }
}
