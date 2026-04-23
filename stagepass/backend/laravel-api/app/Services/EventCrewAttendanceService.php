<?php

namespace App\Services;

use App\Models\Event;
use App\Models\EventAttendanceSession;
use App\Models\EventMeal;
use App\Models\EventUser;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;

/**
 * Per-day event attendance: multi-day events allow check-out and a new check-in the next day.
 * Completed shifts are stored in event_attendance_sessions; event_user row holds the active day only.
 */
class EventCrewAttendanceService
{
    public function __construct(
        private AttendanceOvertimeService $overtime
    ) {}

    public static function appTimezone(): string
    {
        return (string) config('app.timezone', 'Africa/Nairobi');
    }

    public function isMultiDayEvent(Event $event): bool
    {
        if (! $event->end_date) {
            return false;
        }

        return $event->end_date->format('Y-m-d') > $event->date->format('Y-m-d');
    }

    /**
     * Before starting a new check-in: allow multi-day events to start a new day after a completed shift
     * is archived from the pivot. Single-day: completed attendance cannot check in again.
     */
    public function prepareForCheckin(Event $event, EventUser $assignment): ?JsonResponse
    {
        if ($assignment->checkin_time && $assignment->checkout_time) {
            if ($this->isMultiDayEvent($event)) {
                $this->archiveFromPivotIfComplete($assignment);
                $assignment->refresh();
            } else {
                return response()->json([
                    'message' => 'You have already completed attendance for this event.',
                ], 422);
            }
        }

        if ($assignment->checkin_time && ! $assignment->checkout_time) {
            return response()->json([
                'message' => 'Already checked in',
                'checkin_time' => $assignment->checkin_time->toIso8601String(),
            ], 422);
        }

        return null;
    }

    /**
     * Copy a completed row on event_user to event_attendance_sessions and clear the pivot
     * so a new day can get a new check-in.
     */
    public function archiveFromPivotIfComplete(EventUser $assignment): void
    {
        if (! $assignment->checkin_time || ! $assignment->checkout_time) {
            return;
        }

        $workDate = $this->workDateForEventSession($assignment->checkin_time);
        $this->writeSession(
            (int) $assignment->event_id,
            (int) $assignment->user_id,
            $workDate,
            Carbon::parse($assignment->checkin_time),
            Carbon::parse($assignment->checkout_time),
            $assignment
        );
        $this->clearOpenAttendance($assignment);
    }

    public function workDateForEventSession(Carbon|string $checkinTime): string
    {
        return Carbon::parse($checkinTime)->timezone(self::appTimezone())->toDateString();
    }

    /**
     * @param  array{total_hours: float, standard_hours: float, extra_hours: float, is_sunday: bool, is_holiday: bool, holiday_name: ?string, day_type: string}  $calc
     */
    public function finalizeCheckoutWithSession(
        Event $event,
        EventUser $assignment,
        Carbon $checkout,
        array $calc,
        int $pausedMinutes
    ): EventAttendanceSession {
        if (! $assignment->checkin_time) {
            throw new \InvalidArgumentException('No check-in to finalize.');
        }
        if ($assignment->checkout_time) {
            throw new \InvalidArgumentException('Assignment already has checkout on pivot.');
        }

        $workDate = $this->workDateForEventSession($assignment->checkin_time);
        $session = $this->writeSession(
            (int) $event->id,
            (int) $assignment->user_id,
            $workDate,
            Carbon::parse($assignment->checkin_time),
            $checkout,
            $assignment,
            $calc,
            $pausedMinutes
        );

        $this->updateMealEligibility($event, (int) $assignment->user_id, Carbon::parse($assignment->checkin_time), $checkout, $workDate);
        $this->clearOpenAttendance($assignment);

        return $session;
    }

    private function writeSession(
        int $eventId,
        int $userId,
        string $workDate,
        Carbon $checkin,
        Carbon $checkout,
        EventUser $assignment,
        ?array $calc = null,
        ?int $pausedMinutes = null
    ): EventAttendanceSession {
        if ($calc === null) {
            $calc = [
                'total_hours' => (float) ($assignment->total_hours ?? 0),
                'standard_hours' => (float) ($assignment->standard_hours ?? 0),
                'extra_hours' => (float) ($assignment->extra_hours ?? 0),
                'is_sunday' => (bool) $assignment->is_sunday,
                'is_holiday' => (bool) $assignment->is_holiday,
                'holiday_name' => $assignment->holiday_name,
            ];
        }

        return EventAttendanceSession::updateOrCreate(
            [
                'event_id' => $eventId,
                'user_id' => $userId,
                'work_date' => $workDate,
            ],
            [
                'checkin_time' => $checkin,
                'checkout_time' => $checkout,
                'total_hours' => (float) $calc['total_hours'],
                'standard_hours' => (float) $calc['standard_hours'],
                'extra_hours' => (float) $calc['extra_hours'],
                'is_sunday' => (bool) $calc['is_sunday'],
                'is_holiday' => (bool) $calc['is_holiday'],
                'holiday_name' => $calc['holiday_name'] ?? null,
                'pause_duration' => $pausedMinutes !== null
                    ? (int) $pausedMinutes
                    : (int) ($assignment->pause_duration ?? 0),
                'checkin_latitude' => $assignment->checkin_latitude,
                'checkin_longitude' => $assignment->checkin_longitude,
            ]
        );
    }

    private function clearOpenAttendance(EventUser $assignment): void
    {
        $assignment->update([
            'checkin_time' => null,
            'checkout_time' => null,
            'total_hours' => null,
            'standard_hours' => null,
            'extra_hours' => null,
            'is_sunday' => false,
            'is_holiday' => false,
            'holiday_name' => null,
            'is_paused' => false,
            'pause_start_time' => null,
            'pause_end_time' => null,
            'pause_duration' => 0,
            'checkin_latitude' => null,
            'checkin_longitude' => null,
            'overtime_threshold_notified_at' => null,
        ]);
    }

    public function updateMealEligibility(Event $event, int $userId, Carbon $checkin, Carbon $checkout, string $workDate): void
    {
        $tz = self::appTimezone();
        $dayStart = Carbon::parse($workDate . ' 00:00:00', $tz);
        $breakfastCutoff = $dayStart->copy()->setTime(7, 0, 0);
        $dinnerStart = $dayStart->copy()->setTime(19, 30, 0);

        $meals = EventMeal::firstOrCreate(
            [
                'event_id' => $event->id,
                'user_id' => $userId,
                'work_date' => $workDate,
            ],
            ['breakfast' => false, 'lunch' => false, 'dinner' => false]
        );

        if ($checkin->lt($breakfastCutoff)) {
            $meals->breakfast = true;
        }
        $meals->lunch = true;
        if ($checkout->gte($dinnerStart)) {
            $meals->dinner = true;
        }
        $meals->save();
    }

    /**
     * Payment / UI: total hours across all completed sessions plus any open (unchecked-out) session.
     *
     * @return array{total_hours: float, extra_hours: float, pause_duration: int, is_sunday: bool, is_holiday: bool, holiday_name: ?string, day_type: string, transport_type: ?string, transport_amount: ?float, active_hours: float}
     */
    public function paymentAttendanceContext(?Event $event, ?EventUser $assignment): array
    {
        if (! $event || ! $assignment) {
            return [
                'total_hours' => 0.0,
                'extra_hours' => 0.0,
                'pause_duration' => 0,
                'is_sunday' => false,
                'is_holiday' => false,
                'holiday_name' => null,
                'day_type' => 'normal',
                'transport_type' => null,
                'transport_amount' => null,
                'active_hours' => 0.0,
            ];
        }

        $sumTotal = (float) EventAttendanceSession::query()
            ->where('event_id', $event->id)
            ->where('user_id', $assignment->user_id)
            ->sum('total_hours');
        $sumExtra = (float) EventAttendanceSession::query()
            ->where('event_id', $event->id)
            ->where('user_id', $assignment->user_id)
            ->sum('extra_hours');
        if ($assignment->checkin_time && $assignment->checkout_time) {
            if ($sumTotal < 0.0001) {
                $sumTotal = (float) ($assignment->total_hours ?? 0);
            }
            if ($sumExtra < 0.0001) {
                $sumExtra = (float) ($assignment->extra_hours ?? 0);
            }
        }

        $pause = (int) ($assignment->pause_duration ?? 0);
        if ($assignment->is_paused && $assignment->pause_start_time) {
            $pause += (int) Carbon::parse($assignment->pause_start_time)->diffInMinutes(now());
        }

        $openTotal = 0.0;
        $openExtra = 0.0;
        $isSunday = (bool) $assignment->is_sunday;
        $isHoliday = (bool) $assignment->is_holiday;
        $holidayName = $assignment->holiday_name;
        if ($assignment->checkin_time && ! $assignment->checkout_time) {
            $openCalc = $this->overtime->calculate(
                Carbon::parse($assignment->checkin_time),
                now(),
                null,
                $pause
            );
            $openTotal = (float) $openCalc['total_hours'];
            $openExtra = (float) $openCalc['extra_hours'];
            $isSunday = (bool) $openCalc['is_sunday'];
            $isHoliday = (bool) $openCalc['is_holiday'];
            $holidayName = $openCalc['holiday_name'] ?? null;
        }

        $totalHours = $sumTotal + $openTotal;
        $extraHours = $sumExtra + $openExtra;
        $active = round(max(0, $totalHours - ($pause / 60)), 2);

        return [
            'total_hours' => $totalHours,
            'extra_hours' => $extraHours,
            'pause_duration' => $pause,
            'is_sunday' => $isSunday,
            'is_holiday' => $isHoliday,
            'holiday_name' => $holidayName,
            'day_type' => $isHoliday ? 'holiday' : ($isSunday ? 'sunday' : 'normal'),
            'transport_type' => $assignment->transport_type,
            'transport_amount' => $assignment->transport_amount !== null ? (float) $assignment->transport_amount : null,
            'active_hours' => $active,
        ];
    }
}
