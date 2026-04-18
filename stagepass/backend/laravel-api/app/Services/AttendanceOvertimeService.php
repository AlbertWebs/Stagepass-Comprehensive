<?php

namespace App\Services;

use App\Models\EventUser;
use App\Models\Holiday;
use Carbon\Carbon;

class AttendanceOvertimeService
{
    public const STANDARD_MINUTES = 480;

    /**
     * Standard hours = min(worked, 8h). Extra = worked beyond 8h (Sunday/holiday labels kept for reporting UI only).
     *
     * @return array{
     *   day_type: string,
     *   is_sunday: bool,
     *   is_holiday: bool,
     *   holiday_name: string|null,
     *   total_minutes: int,
     *   standard_minutes: int,
     *   extra_minutes: int,
     *   total_hours: float,
     *   standard_hours: float,
     *   extra_hours: float
     * }
     */
    public function calculate(Carbon $checkin, Carbon $asOf, ?string $timezone = null, int $pausedMinutes = 0): array
    {
        $tz = $timezone ?: config('app.timezone', 'Africa/Nairobi');
        $checkinLocal = $checkin->copy()->setTimezone($tz);
        $asOfLocal = $asOf->copy()->setTimezone($tz);

        $rawWorkedMinutes = max(0, $checkinLocal->diffInMinutes($asOfLocal, false));
        $workedMinutes = max(0, $rawWorkedMinutes - max(0, $pausedMinutes));
        $workDate = $checkinLocal->toDateString();

        $holiday = Holiday::query()
            ->where('is_active', true)
            ->whereDate('date', $workDate)
            ->first();
        $isSunday = $checkinLocal->isSunday();
        $isHoliday = $holiday !== null;
        $dayType = $isHoliday ? 'holiday' : ($isSunday ? 'sunday' : 'normal');

        $standardMinutes = min($workedMinutes, self::STANDARD_MINUTES);
        $extraMinutes = max(0, $workedMinutes - self::STANDARD_MINUTES);

        return [
            'day_type' => $dayType,
            'is_sunday' => $isSunday,
            'is_holiday' => $isHoliday,
            'holiday_name' => $holiday?->name,
            'total_minutes' => $workedMinutes,
            'standard_minutes' => $standardMinutes,
            'extra_minutes' => $extraMinutes,
            'total_hours' => round($workedMinutes / 60, 2),
            'standard_hours' => round($standardMinutes / 60, 2),
            'extra_hours' => round($extraMinutes / 60, 2),
        ];
    }

    /**
     * Live or final hours snapshot for an event assignment row (for API payloads).
     *
     * @return array<string, mixed>
     */
    public function snapshotForEventAssignment(EventUser $row): array
    {
        if (! $row->checkin_time) {
            return [
                'hours_status' => 'not_checked_in',
                'total_hours' => null,
                'standard_hours' => null,
                'extra_hours' => null,
            ];
        }

        if ($row->checkout_time) {
            return [
                'hours_status' => 'checked_out',
                'total_hours' => (float) ($row->total_hours ?? 0),
                'standard_hours' => (float) ($row->standard_hours ?? 0),
                'extra_hours' => (float) ($row->extra_hours ?? 0),
            ];
        }

        $checkout = Carbon::now();
        $pausedMinutes = (int) ($row->pause_duration ?? 0);
        if ($row->is_paused && $row->pause_start_time) {
            $pausedMinutes += Carbon::parse($row->pause_start_time)->diffInMinutes($checkout);
        }
        $calc = $this->calculate(Carbon::parse($row->checkin_time), $checkout, null, $pausedMinutes);
        $status = $calc['total_minutes'] < self::STANDARD_MINUTES ? 'within_standard' : 'in_extra_hours';

        return [
            'hours_status' => $status,
            'total_hours' => $calc['total_hours'],
            'standard_hours' => $calc['standard_hours'],
            'extra_hours' => $calc['extra_hours'],
        ];
    }
}
