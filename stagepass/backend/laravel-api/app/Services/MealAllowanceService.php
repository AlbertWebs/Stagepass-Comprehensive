<?php

namespace App\Services;

use App\Models\AllowanceType;
use App\Models\Event;
use App\Models\EventAllowance;
use App\Models\EventUser;
use App\Models\Setting;
use App\Models\User;
use App\Support\EventTeamLeaderGate;
use Carbon\Carbon;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * Automatic meal allowances: role-based amounts and check-in/out eligibility rules.
 */
class MealAllowanceService
{
    public const ROLE_PROJECTS_TEAM_LEAD = 'projects_team_lead';

    public const SLOT_BREAKFAST = 'breakfast';

    public const SLOT_LUNCH = 'lunch';

    public const SLOT_DINNER = 'dinner';

    public function appTimezone(): string
    {
        return 'Africa/Nairobi';
    }

    private function parseAssignmentTime(mixed $value): ?Carbon
    {
        if ($value === null) {
            return null;
        }

        $tz = $this->appTimezone();
        if ($value instanceof Carbon) {
            return Carbon::parse($value->format('Y-m-d H:i:s'), $tz);
        }

        return Carbon::parse($value, $tz);
    }

    public function breakfastCutoffOn(string $workDate): Carbon
    {
        return Carbon::parse($workDate.' 07:00:00', $this->appTimezone());
    }

    public function dinnerCheckoutFromOn(string $workDate): Carbon
    {
        return Carbon::parse($workDate.' 19:30:00', $this->appTimezone());
    }

    public function breakfastCutoff(): Carbon
    {
        return Carbon::parse('07:00', $this->appTimezone());
    }

    public function dinnerCheckoutFrom(): Carbon
    {
        return Carbon::parse('19:30', $this->appTimezone());
    }

    /**
     * @return array{breakfast: bool, lunch: bool, dinner: bool}
     */
    public function computeMealFlags(Carbon $checkin, Carbon $checkout, string $workDate): array
    {
        $tz = $this->appTimezone();
        $dayStart = Carbon::parse($workDate.' 00:00:00', $tz);

        return [
            'breakfast' => $checkin->lt($this->breakfastCutoffOn($workDate)),
            'lunch' => true,
            'dinner' => $checkout->gte($this->dinnerCheckoutFromOn($workDate)),
        ];
    }

    public function receivesLeaderMealAmount(User $user, Event $event): bool
    {
        if ($user->hasRole(self::ROLE_PROJECTS_TEAM_LEAD)) {
            return true;
        }

        return EventTeamLeaderGate::userIsAssignedOrRosterTeamLeader($event, $user);
    }

    public function mealAmountFor(User $user, Event $event): float
    {
        $leaderAmount = (float) Setting::get('meal_allowance_leader_amount', 500);
        $crewAmount = (float) Setting::get('meal_allowance_crew_amount', 200);

        return $this->receivesLeaderMealAmount($user, $event) ? $leaderAmount : $crewAmount;
    }

    public function scheduledTimeForSlot(string $mealSlot): string
    {
        $defaults = [
            self::SLOT_BREAKFAST => '07:00',
            self::SLOT_LUNCH => '13:00',
            self::SLOT_DINNER => '20:00',
        ];

        $key = match ($mealSlot) {
            self::SLOT_BREAKFAST => 'meal_allowance_breakfast_time',
            self::SLOT_LUNCH => 'meal_allowance_lunch_time',
            self::SLOT_DINNER => 'meal_allowance_dinner_time',
            default => null,
        };

        if ($key === null) {
            return '00:00';
        }

        return substr(trim((string) Setting::get($key, $defaults[$mealSlot] ?? '00:00')), 0, 5);
    }

    public function typeNameForSlot(string $mealSlot): string
    {
        return match ($mealSlot) {
            self::SLOT_BREAKFAST => 'Breakfast',
            self::SLOT_LUNCH => 'Lunch',
            self::SLOT_DINNER => 'Dinner',
            default => ucfirst($mealSlot),
        };
    }

    public function qualifiesForSlot(EventUser $assignment, string $mealSlot, string $mealGrantDate): bool
    {
        if (! $assignment->checkin_time) {
            return false;
        }

        $checkin = $this->parseAssignmentTime($assignment->checkin_time);
        $checkout = $this->parseAssignmentTime($assignment->checkout_time);

        return match ($mealSlot) {
            self::SLOT_BREAKFAST => $checkin->lt($this->breakfastCutoffOn($mealGrantDate)),
            self::SLOT_LUNCH => $checkin->toDateString() <= $mealGrantDate
                && ($checkout === null || $checkout->toDateString() >= $mealGrantDate),
            self::SLOT_DINNER => $checkout !== null && $checkout->gte($this->dinnerCheckoutFromOn($mealGrantDate)),
            default => false,
        };
    }

    public function processScheduledSlot(string $mealSlot, Carbon $now): int
    {
        $now = $now->copy()->timezone($this->appTimezone());
        $slotMinute = $now->format('H:i');
        if ($this->scheduledTimeForSlot($mealSlot) !== $slotMinute) {
            return 0;
        }

        $mealGrantDate = $now->toDateString();
        $type = AllowanceType::query()
            ->where('name', $this->typeNameForSlot($mealSlot))
            ->where('is_active', true)
            ->first();

        if (! $type) {
            return 0;
        }

        $query = EventUser::query()
            ->whereNotNull('checkin_time')
            ->whereHas('event', function ($q) use ($mealGrantDate) {
                $q->whereNotIn('status', [Event::STATUS_COMPLETED, Event::STATUS_CLOSED])
                    ->whereDate('date', '<=', $mealGrantDate)
                    ->whereRaw('COALESCE(end_date, date) >= ?', [$mealGrantDate]);
            })
            ->with(['event', 'user']);

        if ($mealSlot === self::SLOT_DINNER) {
            $query->whereNotNull('checkout_time');
        }

        $granted = 0;
        foreach ($query->get() as $assignment) {
            if (! $assignment->event || ! $assignment->user) {
                continue;
            }
            if (! $this->qualifiesForSlot($assignment, $mealSlot, $mealGrantDate)) {
                continue;
            }
            if ($this->grantMealAllowance($assignment->event, $assignment, $assignment->user, $mealSlot, $mealGrantDate, $type->id)) {
                $granted++;
            }
        }

        return $granted;
    }

    public function tryGrantDinnerOnCheckout(Event $event, EventUser $assignment, Carbon $checkout): bool
    {
        $assignment->loadMissing('user');
        $user = $assignment->user;
        if (! $user || ! $assignment->checkin_time) {
            return false;
        }

        $workDate = app(EventCrewAttendanceService::class)->workDateForEventSession($assignment->checkin_time);
        if (! $this->qualifiesForSlot($assignment->fresh(), self::SLOT_DINNER, $workDate)) {
            return false;
        }

        $type = AllowanceType::query()
            ->where('name', $this->typeNameForSlot(self::SLOT_DINNER))
            ->where('is_active', true)
            ->first();

        if (! $type) {
            return false;
        }

        return $this->grantMealAllowance($event, $assignment, $user, self::SLOT_DINNER, $workDate, $type->id);
    }

    public function grantMealAllowance(
        Event $event,
        EventUser $assignment,
        User $user,
        string $mealSlot,
        string $mealGrantDate,
        int $allowanceTypeId
    ): bool {
        $amount = $this->mealAmountFor($user, $event);
        if ($amount <= 0) {
            return false;
        }

        $dedupeKey = $event->id.'-'.$assignment->user_id.'-'.$mealSlot.'-'.$mealGrantDate;

        try {
            return (bool) DB::transaction(function () use ($event, $assignment, $user, $mealSlot, $mealGrantDate, $allowanceTypeId, $amount, $dedupeKey) {
                if (EventAllowance::query()->where('dedupe_key', $dedupeKey)->exists()) {
                    return false;
                }

                EventAllowance::create([
                    'event_id' => $event->id,
                    'crew_id' => $assignment->user_id,
                    'allowance_type_id' => $allowanceTypeId,
                    'amount' => $amount,
                    'description' => 'Automatic meal allowance',
                    'recorded_by' => $user->id,
                    'recorded_at' => now(),
                    'status' => EventAllowance::STATUS_APPROVED,
                    'approved_by' => null,
                    'approved_at' => now(),
                    'source' => EventAllowance::SOURCE_AUTOMATIC,
                    'meal_slot' => $mealSlot,
                    'meal_grant_date' => $mealGrantDate,
                    'dedupe_key' => $dedupeKey,
                ]);

                return true;
            });
        } catch (UniqueConstraintViolationException) {
            return false;
        }
    }
}
