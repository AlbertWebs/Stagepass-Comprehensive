<?php

namespace App\Support;

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
     * Normalize event crew pivot datetime fields on an event array payload.
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
        }
        unset($member);
    }
}
