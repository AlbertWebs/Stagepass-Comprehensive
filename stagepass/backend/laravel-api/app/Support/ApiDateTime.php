<?php

namespace App\Support;

use App\Models\EventAttendanceSession;
use Carbon\Carbon;
use Illuminate\Support\Collection;

final class ApiDateTime
{
    /** Timezone used for attendance timestamps shown to users (East Africa). */
    public const DISPLAY_TZ = 'Africa/Nairobi';

    /**
     * Serialize a stored datetime for API clients with an explicit offset.
     */
    public static function toIso(?Carbon $value): ?string
    {
        if ($value === null) {
            return null;
        }

        return $value->copy()->timezone(self::DISPLAY_TZ)->toIso8601String();
    }

    /**
     * Format clock time in 24-hour HH:mm for display.
     */
    public static function toHm(?Carbon $value): ?string
    {
        if ($value === null) {
            return null;
        }

        return $value->copy()->timezone(self::DISPLAY_TZ)->format('H:i');
    }

    /**
     * Normalize event crew pivot datetime fields on an event array payload.
     * When multi-day checkout archived times into sessions, surface those for Time In / Time Out.
     *
     * @param  array<string, mixed>  $data
     * @param  Collection<int|string, \App\Models\EventUser>  $assignmentsByUserId
     */
    public static function normalizeEventCrewPivotTimes(array &$data, Collection $assignmentsByUserId): void
    {
        if (! isset($data['crew']) || ! is_array($data['crew'])) {
            return;
        }

        $pivotDateFields = [
            'checkin_time',
            'checkout_time',
            'pause_start_time',
            'pause_end_time',
            'transport_recorded_at',
        ];

        $eventId = isset($data['id']) ? (int) $data['id'] : null;
        $userIds = $assignmentsByUserId->keys()->map(fn ($id) => (int) $id)->filter()->values();
        $sessionsByUser = collect();
        if ($eventId && $userIds->isNotEmpty()) {
            $sessionsByUser = EventAttendanceSession::query()
                ->where('event_id', $eventId)
                ->whereIn('user_id', $userIds)
                ->orderByDesc('work_date')
                ->orderByDesc('checkin_time')
                ->get()
                ->groupBy('user_id');
        }

        foreach ($data['crew'] as &$member) {
            $uid = isset($member['id']) ? (int) $member['id'] : null;
            if ($uid === null || ! $assignmentsByUserId->has($uid)) {
                continue;
            }
            $assignment = $assignmentsByUserId->get($uid);
            if (! isset($member['pivot']) || ! is_array($member['pivot'])) {
                $member['pivot'] = [];
            }
            foreach ($pivotDateFields as $field) {
                if ($assignment->{$field} !== null) {
                    $member['pivot'][$field] = self::toIso($assignment->{$field});
                }
            }

            // Completed multi-day shifts clear the pivot — restore latest session times for UI.
            if (empty($member['pivot']['checkin_time']) || empty($member['pivot']['checkout_time'])) {
                $latestSession = $sessionsByUser->get($uid)?->first();
                if ($latestSession) {
                    if (empty($member['pivot']['checkin_time']) && $latestSession->checkin_time) {
                        $member['pivot']['checkin_time'] = self::toIso($latestSession->checkin_time);
                    }
                    if (empty($member['pivot']['checkout_time']) && $latestSession->checkout_time) {
                        $member['pivot']['checkout_time'] = self::toIso($latestSession->checkout_time);
                    }
                    if (! isset($member['pivot']['total_hours']) || $member['pivot']['total_hours'] === null) {
                        $member['pivot']['total_hours'] = $latestSession->total_hours !== null
                            ? (float) $latestSession->total_hours
                            : null;
                    }
                    if (! isset($member['pivot']['standard_hours']) || $member['pivot']['standard_hours'] === null) {
                        $member['pivot']['standard_hours'] = $latestSession->standard_hours !== null
                            ? (float) $latestSession->standard_hours
                            : null;
                    }
                    if (! isset($member['pivot']['extra_hours']) || $member['pivot']['extra_hours'] === null) {
                        $member['pivot']['extra_hours'] = $latestSession->extra_hours !== null
                            ? (float) $latestSession->extra_hours
                            : null;
                    }
                }
            }
        }
        unset($member);
    }
}
