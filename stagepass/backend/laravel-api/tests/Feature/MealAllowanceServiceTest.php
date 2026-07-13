<?php

namespace Tests\Feature;

use App\Models\AllowanceType;
use App\Models\Event;
use App\Models\EventAllowance;
use App\Models\EventMeal;
use App\Models\EventUser;
use App\Models\Role;
use App\Models\User;
use App\Services\MealAllowanceService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MealAllowanceServiceTest extends TestCase
{
    use RefreshDatabase;

    private MealAllowanceService $meals;

    protected function setUp(): void
    {
        parent::setUp();
        config(['app.timezone' => 'Africa/Nairobi']);
        $this->meals = app(MealAllowanceService::class);

        foreach (['Breakfast', 'Lunch', 'Dinner'] as $name) {
            AllowanceType::query()->firstOrCreate(['name' => $name], ['is_active' => true]);
        }
    }

    private function attachRole(User $user, string $name, string $label): void
    {
        $role = Role::firstOrCreate(['name' => $name], ['label' => $label]);
        $user->roles()->syncWithoutDetaching([$role->id]);
    }

    private function activeEvent(array $overrides = []): Event
    {
        return Event::create(array_merge([
            'name' => 'Meal Test Event',
            'date' => '2026-06-30',
            'start_time' => '06:00',
            'expected_end_time' => '23:00',
            'status' => Event::STATUS_ACTIVE,
        ], $overrides));
    }

    public function test_crew_member_receives_200_lunch_at_1pm_when_checked_in(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-30 13:00:00', 'Africa/Nairobi'));

        $event = $this->activeEvent();
        $crew = User::factory()->create();
        EventUser::create([
            'event_id' => $event->id,
            'user_id' => $crew->id,
            'checkin_time' => '2026-06-30 08:00:00',
        ]);

        $granted = $this->meals->processScheduledSlot(MealAllowanceService::SLOT_LUNCH, now());

        $this->assertSame(1, $granted);
        $row = EventAllowance::query()->where('crew_id', $crew->id)->where('meal_slot', 'lunch')->first();
        $this->assertNotNull($row);
        $this->assertEquals(200.0, (float) $row->amount);
        $this->assertSame(EventAllowance::STATUS_APPROVED, $row->status);
    }

    public function test_event_team_leader_receives_500_for_lunch(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-30 13:00:00', 'Africa/Nairobi'));

        $leader = User::factory()->create();
        $event = $this->activeEvent(['team_leader_id' => $leader->id]);
        EventUser::create([
            'event_id' => $event->id,
            'user_id' => $leader->id,
            'role_in_event' => 'Team Leader',
            'checkin_time' => '2026-06-30 08:00:00',
        ]);

        $this->meals->processScheduledSlot(MealAllowanceService::SLOT_LUNCH, now());

        $row = EventAllowance::query()->where('crew_id', $leader->id)->where('meal_slot', 'lunch')->first();
        $this->assertNotNull($row);
        $this->assertEquals(500.0, (float) $row->amount);
    }

    public function test_projects_team_lead_receives_500_for_lunch(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-30 13:00:00', 'Africa/Nairobi'));

        $ptl = User::factory()->create();
        $this->attachRole($ptl, 'projects_team_lead', 'Projects Team Lead');

        $event = $this->activeEvent();
        EventUser::create([
            'event_id' => $event->id,
            'user_id' => $ptl->id,
            'checkin_time' => '2026-06-30 08:00:00',
        ]);

        $this->meals->processScheduledSlot(MealAllowanceService::SLOT_LUNCH, now());

        $row = EventAllowance::query()->where('crew_id', $ptl->id)->where('meal_slot', 'lunch')->first();
        $this->assertNotNull($row);
        $this->assertEquals(500.0, (float) $row->amount);
    }

    public function test_lunch_granted_when_checked_out_before_1pm_same_day(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-30 13:00:00', 'Africa/Nairobi'));

        $event = $this->activeEvent();
        $crew = User::factory()->create();
        EventUser::create([
            'event_id' => $event->id,
            'user_id' => $crew->id,
            'checkin_time' => '2026-06-30 08:00:00',
            'checkout_time' => '2026-06-30 12:00:00',
        ]);

        $granted = $this->meals->processScheduledSlot(MealAllowanceService::SLOT_LUNCH, now());

        $this->assertSame(1, $granted);
        $row = EventAllowance::query()->where('crew_id', $crew->id)->where('meal_slot', 'lunch')->first();
        $this->assertNotNull($row);
        $this->assertEquals(200.0, (float) $row->amount);
    }

    public function test_breakfast_granted_only_when_checkin_before_7am(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-30 07:00:00', 'Africa/Nairobi'));

        $event = $this->activeEvent();
        $early = User::factory()->create();
        $late = User::factory()->create();

        EventUser::create([
            'event_id' => $event->id,
            'user_id' => $early->id,
            'checkin_time' => '2026-06-30 06:30:00',
        ]);
        EventUser::create([
            'event_id' => $event->id,
            'user_id' => $late->id,
            'checkin_time' => '2026-06-30 07:15:00',
        ]);

        $granted = $this->meals->processScheduledSlot(MealAllowanceService::SLOT_BREAKFAST, now());

        $this->assertSame(1, $granted);
        $this->assertTrue(EventAllowance::query()->where('crew_id', $early->id)->where('meal_slot', 'breakfast')->exists());
        $this->assertFalse(EventAllowance::query()->where('crew_id', $late->id)->where('meal_slot', 'breakfast')->exists());
    }

    public function test_dinner_granted_on_checkout_after_730pm_with_correct_amounts(): void
    {
        $event = $this->activeEvent();
        $crew = User::factory()->create();
        $leader = User::factory()->create();
        $event->update(['team_leader_id' => $leader->id]);

        $crewAssignment = EventUser::create([
            'event_id' => $event->id,
            'user_id' => $crew->id,
            'checkin_time' => '2026-06-30 09:00:00',
        ]);
        $leaderAssignment = EventUser::create([
            'event_id' => $event->id,
            'user_id' => $leader->id,
            'checkin_time' => '2026-06-30 09:00:00',
        ]);

        $checkout = Carbon::parse('2026-06-30 20:00:00', 'Africa/Nairobi');
        $crewAssignment->update(['checkout_time' => '2026-06-30 20:00:00']);
        $leaderAssignment->update(['checkout_time' => '2026-06-30 20:00:00']);

        $this->meals->tryGrantDinnerOnCheckout($event, $crewAssignment->fresh(), $checkout);
        $this->meals->tryGrantDinnerOnCheckout($event, $leaderAssignment->fresh(), $checkout);

        $crewRow = EventAllowance::query()->where('crew_id', $crew->id)->where('meal_slot', 'dinner')->first();
        $leaderRow = EventAllowance::query()->where('crew_id', $leader->id)->where('meal_slot', 'dinner')->first();

        $this->assertEquals(200.0, (float) $crewRow->amount);
        $this->assertEquals(500.0, (float) $leaderRow->amount);
    }

    public function test_dinner_not_granted_when_checkout_before_730pm(): void
    {
        $event = $this->activeEvent();
        $crew = User::factory()->create();
        $assignment = EventUser::create([
            'event_id' => $event->id,
            'user_id' => $crew->id,
            'checkin_time' => '2026-06-30 09:00:00',
            'checkout_time' => '2026-06-30 18:00:00',
        ]);

        $checkout = Carbon::parse('2026-06-30 18:00:00', 'Africa/Nairobi');
        $granted = $this->meals->tryGrantDinnerOnCheckout($event, $assignment, $checkout);

        $this->assertFalse($granted);
        $this->assertFalse(EventAllowance::query()->where('crew_id', $crew->id)->where('meal_slot', 'dinner')->exists());
    }

    public function test_meal_flags_match_eligibility_on_checkout(): void
    {
        $checkin = Carbon::parse('2026-06-30 06:45:00', 'Africa/Nairobi');
        $checkout = Carbon::parse('2026-06-30 20:15:00', 'Africa/Nairobi');

        $flags = $this->meals->computeMealFlags($checkin, $checkout, '2026-06-30');

        $this->assertTrue($flags['breakfast']);
        $this->assertTrue($flags['lunch']);
        $this->assertTrue($flags['dinner']);

        $lateBreakfast = $this->meals->computeMealFlags(
            Carbon::parse('2026-06-30 07:30:00', 'Africa/Nairobi'),
            Carbon::parse('2026-06-30 18:00:00', 'Africa/Nairobi'),
            '2026-06-30'
        );
        $this->assertFalse($lateBreakfast['breakfast']);
        $this->assertTrue($lateBreakfast['lunch']);
        $this->assertFalse($lateBreakfast['dinner']);
    }

    public function test_dinner_cron_at_8pm_grants_eligible_checked_out_crew(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-30 20:00:00', 'Africa/Nairobi'));

        $event = $this->activeEvent();
        $crew = User::factory()->create();
        EventUser::create([
            'event_id' => $event->id,
            'user_id' => $crew->id,
            'checkin_time' => '2026-06-30 09:00:00',
            'checkout_time' => '2026-06-30 19:45:00',
        ]);

        $granted = $this->meals->processScheduledSlot(MealAllowanceService::SLOT_DINNER, now());

        $this->assertSame(1, $granted);
        $this->assertTrue(EventAllowance::query()->where('crew_id', $crew->id)->where('meal_slot', 'dinner')->exists());
    }

    public function test_lunch_catch_up_after_1pm_still_grants(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-30 13:17:00', 'Africa/Nairobi'));

        $event = $this->activeEvent();
        $crew = User::factory()->create();
        EventUser::create([
            'event_id' => $event->id,
            'user_id' => $crew->id,
            'checkin_time' => '2026-06-30 08:00:00',
        ]);

        $granted = $this->meals->processScheduledSlot(MealAllowanceService::SLOT_LUNCH, now());

        $this->assertSame(1, $granted);
        $this->assertTrue(EventAllowance::query()->where('crew_id', $crew->id)->where('meal_slot', 'lunch')->exists());
    }

    public function test_lunch_not_granted_before_scheduled_time(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-30 12:59:00', 'Africa/Nairobi'));

        $event = $this->activeEvent();
        $crew = User::factory()->create();
        EventUser::create([
            'event_id' => $event->id,
            'user_id' => $crew->id,
            'checkin_time' => '2026-06-30 08:00:00',
        ]);

        $granted = $this->meals->processScheduledSlot(MealAllowanceService::SLOT_LUNCH, now());

        $this->assertSame(0, $granted);
        $this->assertFalse(EventAllowance::query()->where('crew_id', $crew->id)->where('meal_slot', 'lunch')->exists());
    }
}
