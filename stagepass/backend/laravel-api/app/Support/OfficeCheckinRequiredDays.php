<?php

namespace App\Support;

use App\Models\Setting;
use Carbon\Carbon;

/**
 * Which weekdays require office check-in (0 = Sunday … 6 = Saturday), matching JS Date.getDay().
 */
final class OfficeCheckinRequiredDays
{
    /** @var list<int> */
    private const DEFAULT = [1, 2, 3, 4, 5];

    /**
     * @return list<int>
     */
    public static function parsed(): array
    {
        $raw = Setting::get('office_checkin_required_days');
        if ($raw === null || $raw === '') {
            return self::DEFAULT;
        }
        $decoded = null;
        if (is_array($raw)) {
            $decoded = $raw;
        } elseif (is_string($raw)) {
            $decoded = json_decode($raw, true);
        }
        if (is_array($decoded)) {
            $days = [];
            foreach ($decoded as $d) {
                $n = (int) $d;
                if ($n >= 0 && $n <= 6) {
                    $days[$n] = $n;
                }
            }
            $out = array_values($days);
            sort($out);

            return count($out) > 0 ? $out : self::DEFAULT;
        }

        return self::DEFAULT;
    }

    public static function isRequiredForInstant(Carbon $instantInTz): bool
    {
        $dow = (int) $instantInTz->format('w');

        return in_array($dow, self::parsed(), true);
    }
}
