<?php

namespace App\Services;

use App\Models\Holiday;
use Carbon\Carbon;

class AttendanceOvertimeService
{
    public const STANDARD_MINUTES = 480;

    /**
     * @return array{
     *   day_type: string,
     *   is_sunday: bool,
     *   is_holiday: bool,
     *   holiday_name: string|null,
     *   total_minutes: int,
     *   extra_minutes: int,
     *   total_hours: float,
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
        $allExtra = $isSunday || $isHoliday;
        $extraMinutes = $allExtra
            ? $workedMinutes
            : max(0, $workedMinutes - self::STANDARD_MINUTES);

        $dayType = $isHoliday ? 'holiday' : ($isSunday ? 'sunday' : 'normal');

        return [
            'day_type' => $dayType,
            'is_sunday' => $isSunday,
            'is_holiday' => $isHoliday,
            'holiday_name' => $holiday?->name,
            'total_minutes' => $workedMinutes,
            'extra_minutes' => $extraMinutes,
            'total_hours' => round($workedMinutes / 60, 2),
            'extra_hours' => round($extraMinutes / 60, 2),
        ];
    }
}
