<?php

namespace App\Services;

use App\Models\Event;
use App\Models\EventAllowance;
use App\Models\EventAttendanceSession;
use App\Models\EventMeal;
use App\Models\EventPayment;
use App\Models\EventUser;
use Carbon\Carbon;

/**
 * Recalculates related rows when an event's date or time span changes.
 */
class EventDateAdjustmentService
{
    public function __construct(
        private EventCrewAttendanceService $crewAttendance,
        private AttendanceOvertimeService $overtime
    ) {}

    /**
     * @param  array{date?: string, end_date?: string|null, start_time?: string|null, expected_end_time?: string|null}  $previous
     * @return array<string, mixed>
     */
    public function adjust(Event $event, array $previous): array
    {
        $summary = [
            'attendance_sessions_shifted' => 0,
            'meals_shifted' => 0,
            'allowances_shifted' => 0,
            'open_checkins_closed' => 0,
            'payments_shifted' => 0,
            'warnings' => [],
        ];

        $oldStart = $previous['date'] ?? $event->date->format('Y-m-d');
        $dayDelta = $this->dayDelta($oldStart, $event->date->format('Y-m-d'));
        $spanStart = $event->date->format('Y-m-d');
        $spanEnd = $this->crewAttendance->effectiveLastCalendarDate($event);

        $sessions = EventAttendanceSession::query()->where('event_id', $event->id)->get();
        foreach ($sessions as $session) {
            $workDate = $session->work_date->format('Y-m-d');
            $newDate = $dayDelta !== 0 ? $this->shiftDate($workDate, $dayDelta) : $workDate;
            if (! $this->dateInSpan($newDate, $spanStart, $spanEnd)) {
                if ($dayDelta !== 0 && $this->dateInSpan($workDate, $spanStart, $spanEnd)) {
                    $newDate = $workDate;
                } else {
                    $summary['warnings'][] = sprintf(
                        'Attendance session on %s for user #%d could not be moved into the new event span.',
                        $workDate,
                        $session->user_id
                    );
                    continue;
                }
            }
            if ($newDate !== $workDate) {
                $session->update(['work_date' => $newDate]);
                $summary['attendance_sessions_shifted']++;
            }
        }

        $meals = EventMeal::query()->where('event_id', $event->id)->get();
        foreach ($meals as $meal) {
            $workDate = $meal->work_date
                ? Carbon::parse($meal->work_date)->format('Y-m-d')
                : $spanStart;
            $newDate = $dayDelta !== 0 ? $this->shiftDate($workDate, $dayDelta) : $workDate;
            if (! $this->dateInSpan($newDate, $spanStart, $spanEnd)) {
                $clamped = $this->clampToSpan($newDate, $spanStart, $spanEnd);
                if ($clamped === null) {
                    $summary['warnings'][] = sprintf(
                        'Meal record on %s for user #%d could not be moved into the new event span.',
                        $workDate,
                        $meal->user_id
                    );
                    continue;
                }
                $newDate = $clamped;
            }
            if ($newDate !== $workDate) {
                $meal->update(['work_date' => $newDate]);
                $summary['meals_shifted']++;
            }
        }

        $allowances = EventAllowance::query()->where('event_id', $event->id)->get();
        foreach ($allowances as $allowance) {
            if (! $allowance->meal_grant_date) {
                continue;
            }
            $grantDate = $allowance->meal_grant_date->format('Y-m-d');
            $newDate = $dayDelta !== 0 ? $this->shiftDate($grantDate, $dayDelta) : $grantDate;
            if (! $this->dateInSpan($newDate, $spanStart, $spanEnd)) {
                $clamped = $this->clampToSpan($newDate, $spanStart, $spanEnd);
                if ($clamped === null) {
                    $summary['warnings'][] = sprintf(
                        'Allowance meal date %s (row #%d) could not be moved into the new event span.',
                        $grantDate,
                        $allowance->id
                    );
                    continue;
                }
                $newDate = $clamped;
            }
            if ($newDate !== $grantDate) {
                $allowance->update(['meal_grant_date' => $newDate]);
                $summary['allowances_shifted']++;
            }
        }

        $assignments = EventUser::query()->where('event_id', $event->id)->get();
        foreach ($assignments as $assignment) {
            if (! $assignment->checkin_time || $assignment->checkout_time) {
                continue;
            }
            $workDate = $this->crewAttendance->workDateForEventSession($assignment->checkin_time);
            if ($this->dateInSpan($workDate, $spanStart, $spanEnd)) {
                continue;
            }
            if ($this->crewAttendance->checkoutOpenAssignment($event, $assignment)) {
                $summary['open_checkins_closed']++;
            }
        }

        if ($dayDelta !== 0) {
            $payments = EventPayment::query()->where('event_id', $event->id)->get();
            foreach ($payments as $payment) {
                if (! $payment->payment_date) {
                    continue;
                }
                $paymentDate = $payment->payment_date->format('Y-m-d');
                if ($paymentDate !== $oldStart) {
                    continue;
                }
                $payment->update(['payment_date' => $spanStart]);
                $summary['payments_shifted']++;
            }
        }

        return $summary;
    }

    private function dayDelta(string $oldStart, string $newStart): int
    {
        if ($oldStart === $newStart) {
            return 0;
        }

        return (int) Carbon::parse($oldStart)->diffInDays(Carbon::parse($newStart), false);
    }

    private function shiftDate(string $date, int $delta): string
    {
        return Carbon::parse($date)->addDays($delta)->format('Y-m-d');
    }

    private function dateInSpan(string $date, string $start, string $end): bool
    {
        return $start <= $date && $date <= $end;
    }

    private function clampToSpan(string $date, string $start, string $end): ?string
    {
        if ($date < $start) {
            return $start;
        }
        if ($date > $end) {
            return $end;
        }

        return null;
    }
}
