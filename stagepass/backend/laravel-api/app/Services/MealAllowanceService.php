<?php

namespace App\Services;

use App\Models\AllowanceType;
use App\Models\Event;
use App\Models\EventAllowance;
use App\Models\EventAttendanceSession;
use App\Models\EventUser;
use App\Models\Setting;
use App\Models\User;
use App\Support\EventTeamLeaderGate;
use Carbon\Carbon;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

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

        return $this->normalizeHm((string) Setting::get($key, $defaults[$mealSlot] ?? '00:00'), $defaults[$mealSlot] ?? '00:00');
    }

    /**
     * Slot is due at/after its scheduled time for the rest of that calendar day (catch-up safe with dedupe).
     */
    public function isSlotDue(string $mealSlot, Carbon $now): bool
    {
        $now = $now->copy()->timezone($this->appTimezone());
        $scheduledMins = $this->hmToMinutes($this->scheduledTimeForSlot($mealSlot));
        $nowMins = $this->hmToMinutes($now->format('H:i'));

        return $scheduledMins !== null && $nowMins !== null && $nowMins >= $scheduledMins;
    }

    public function normalizeHm(mixed $value, string $fallback = '00:00'): string
    {
        $raw = trim((string) $value);
        if ($raw === '') {
            return $fallback;
        }

        if (preg_match('/^(\d{1,2}):(\d{2})/', $raw, $m)) {
            return sprintf('%02d:%02d', (int) $m[1], (int) $m[2]);
        }

        return $fallback;
    }

    public function hmToMinutes(string $hm): ?int
    {
        if (! preg_match('/^(\d{1,2}):(\d{2})$/', $this->normalizeHm($hm), $m)) {
            return null;
        }

        return ((int) $m[1]) * 60 + (int) $m[2];
    }

    public function ensureMealAllowanceType(string $mealSlot): ?AllowanceType
    {
        $name = $this->typeNameForSlot($mealSlot);

        return AllowanceType::query()->firstOrCreate(
            ['name' => $name],
            ['is_active' => true]
        );
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

        return $this->qualifiesTimesForSlot($mealSlot, $checkin, $checkout, $mealGrantDate);
    }

    /**
     * Dinner: checked out at/after 19:30, or still checked in once the dinner window has started.
     */
    public function qualifiesTimesForSlot(
        string $mealSlot,
        ?Carbon $checkin,
        ?Carbon $checkout,
        string $mealGrantDate,
        ?Carbon $asOf = null
    ): bool {
        if (! $checkin) {
            return false;
        }

        $asOf = ($asOf ?? now())->copy()->timezone($this->appTimezone());

        return match ($mealSlot) {
            self::SLOT_BREAKFAST => $checkin->lt($this->breakfastCutoffOn($mealGrantDate)),
            self::SLOT_LUNCH => $checkin->toDateString() <= $mealGrantDate
                && ($checkout === null || $checkout->toDateString() >= $mealGrantDate),
            self::SLOT_DINNER => $this->qualifiesForDinner($checkin, $checkout, $mealGrantDate, $asOf),
            default => false,
        };
    }

    public function qualifiesForDinner(
        Carbon $checkin,
        ?Carbon $checkout,
        string $mealGrantDate,
        ?Carbon $asOf = null
    ): bool {
        $threshold = $this->dinnerCheckoutFromOn($mealGrantDate);
        $asOf = ($asOf ?? now())->copy()->timezone($this->appTimezone());

        if ($checkout !== null) {
            return $checkout->gte($threshold);
        }

        // Still on site past dinner time — count as present for dinner.
        return $asOf->gte($threshold) && $checkin->toDateString() <= $mealGrantDate;
    }

    public function processScheduledSlot(string $mealSlot, Carbon $now): int
    {
        $now = $now->copy()->timezone($this->appTimezone());
        $scheduled = $this->scheduledTimeForSlot($mealSlot);
        if (! $this->isSlotDue($mealSlot, $now)) {
            return 0;
        }

        $mealGrantDate = $now->toDateString();
        $type = $this->ensureMealAllowanceType($mealSlot);
        if (! $type || ! $type->is_active) {
            Log::warning('allowances:process-meals skipped slot: missing/inactive allowance type', [
                'slot' => $mealSlot,
                'type' => $this->typeNameForSlot($mealSlot),
                'scheduled' => $scheduled,
                'now' => $now->toIso8601String(),
            ]);

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

        $assignments = $query->get();
        $granted = 0;
        $skippedQualify = 0;
        $skippedGrant = 0;

        foreach ($assignments as $assignment) {
            if (! $assignment->event || ! $assignment->user) {
                $skippedGrant++;
                continue;
            }
            if (! $this->qualifiesForSlot($assignment, $mealSlot, $mealGrantDate)) {
                $skippedQualify++;
                continue;
            }
            if ($this->grantMealAllowance($assignment->event, $assignment, $assignment->user, $mealSlot, $mealGrantDate, $type->id)) {
                $granted++;
            } else {
                $skippedGrant++;
            }
        }

        if ($mealSlot === self::SLOT_DINNER) {
            // Recover dinners cleared into attendance sessions (incl. recent past days).
            for ($i = 0; $i < 7; $i++) {
                $d = $now->copy()->subDays($i)->toDateString();
                $granted += $this->grantDinnerFromCompletedSessions($d, (int) $type->id, $now);
            }
        }

        Log::info('allowances:process-meals slot processed', [
            'slot' => $mealSlot,
            'scheduled' => $scheduled,
            'now' => $now->format('Y-m-d H:i:s T'),
            'candidates' => $assignments->count(),
            'granted' => $granted,
            'skipped_qualify' => $skippedQualify,
            'skipped_grant_or_dedupe' => $skippedGrant,
        ]);

        return $granted;
    }

    /**
     * Multi-day checkouts clear event_user times into sessions — catch up dinner from those rows.
     */
    public function grantDinnerFromCompletedSessions(string $mealGrantDate, int $allowanceTypeId, ?Carbon $asOf = null): int
    {
        $asOf = ($asOf ?? now())->copy()->timezone($this->appTimezone());
        $threshold = $this->dinnerCheckoutFromOn($mealGrantDate);
        $sessions = EventAttendanceSession::query()
            ->whereDate('work_date', $mealGrantDate)
            ->whereNotNull('checkin_time')
            ->whereNotNull('checkout_time')
            ->where('checkout_time', '>=', $threshold->format('Y-m-d H:i:s'))
            ->with(['event', 'user'])
            ->get();

        $granted = 0;
        foreach ($sessions as $session) {
            if (! $session->event || ! $session->user) {
                continue;
            }
            $assignment = EventUser::query()
                ->where('event_id', $session->event_id)
                ->where('user_id', $session->user_id)
                ->first();
            if (! $assignment) {
                continue;
            }
            if ($this->grantMealAllowance(
                $session->event,
                $assignment,
                $session->user,
                self::SLOT_DINNER,
                $mealGrantDate,
                $allowanceTypeId
            )) {
                $granted++;
            }
        }

        return $granted;
    }

    public function tryGrantDinnerOnCheckout(
        Event $event,
        EventUser $assignment,
        Carbon $checkout,
        ?Carbon $checkin = null
    ): bool {
        $assignment->loadMissing('user');
        $user = $assignment->user;
        $checkin = $checkin
            ? $checkin->copy()->timezone($this->appTimezone())
            : $this->parseAssignmentTime($assignment->checkin_time);
        if (! $user || ! $checkin) {
            return false;
        }

        $workDate = app(EventCrewAttendanceService::class)->workDateForEventSession($checkin);
        if (! $this->qualifiesForDinner($checkin, $checkout->copy()->timezone($this->appTimezone()), $workDate, $checkout)) {
            return false;
        }

        $type = $this->ensureMealAllowanceType(self::SLOT_DINNER);
        if (! $type || ! $type->is_active) {
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
