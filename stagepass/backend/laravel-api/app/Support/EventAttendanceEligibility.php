<?php

namespace App\Support;

use App\Models\Event;
use Carbon\Carbon;

/**
 * Central rules for whether an event’s scheduled window has ended (time-based)
 * and whether attendance actions are blocked by event status.
 */
final class EventAttendanceEligibility
{
    public static function tz(): string
    {
        return (string) config('app.timezone', 'UTC');
    }

    public static function isEndedStatus(Event $event): bool
    {
        return in_array($event->status, [
            Event::STATUS_COMPLETED,
            Event::STATUS_CLOSED,
            Event::STATUS_DONE_FOR_DAY,
        ], true);
    }

    /**
     * Last moment of the scheduled event (local app timezone).
     * Single-day overnight: end time before start time → end is the day after `date`.
     * Multi-day: last calendar day is `end_date` when set, else derived overnight rule.
     */
    public static function scheduledEnd(Event $event): Carbon
    {
        $tz = self::tz();
        $startDate = $event->date->format('Y-m-d');
        $startHm = substr((string) ($event->start_time ?? '00:00'), 0, 5);
        $endRaw = $event->expected_end_time;
        $endHm = $endRaw ? substr((string) $endRaw, 0, 5) : '23:59';
        $endTimeStr = $endRaw && strlen((string) $endRaw) >= 8
            ? (string) $endRaw
            : $endHm.':59';

        if ($event->end_date) {
            $lastDay = $event->end_date->format('Y-m-d');
        } else {
            $lastDay = $startDate;
            $sm = self::hmToMins($startHm);
            $em = self::hmToMins($endHm);
            if ($sm !== null && $em !== null && $em < $sm) {
                $lastDay = Carbon::parse($startDate, $tz)->addDay()->format('Y-m-d');
            }
        }

        return Carbon::parse($lastDay.' '.$endTimeStr, $tz);
    }

    public static function eventTimeHasPassed(Event $event, ?Carbon $now = null): bool
    {
        $now = $now ?? Carbon::now(self::tz());

        return $now->greaterThan(self::scheduledEnd($event));
    }

    public static function canCheckIn(Event $event, ?Carbon $now = null): bool
    {
        if (self::isEndedStatus($event)) {
            return false;
        }

        return ! self::eventTimeHasPassed($event, $now);
    }

    public static function canCheckOut(Event $event, ?Carbon $now = null): bool
    {
        if (self::isEndedStatus($event)) {
            return false;
        }

        return true;
    }

    private static function hmToMins(?string $hm): ?int
    {
        if ($hm === null || $hm === '') {
            return null;
        }
        $p = explode(':', $hm);
        $h = (int) ($p[0] ?? 0);
        $m = (int) ($p[1] ?? 0);

        return $h * 60 + $m;
    }
}
