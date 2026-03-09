<?php

namespace App\Services;

class GeofenceService
{
    /**
     * Earth radius in meters (Haversine formula).
     */
    private const EARTH_RADIUS_METERS = 6371000;

    /**
     * Check if user coordinates are within the event geofence.
     */
    public function isWithinRadius(
        float $userLat,
        float $userLon,
        float $eventLat,
        float $eventLon,
        int $radiusMeters
    ): bool {
        $distance = $this->haversineDistance($userLat, $userLon, $eventLat, $eventLon);

        return $distance <= $radiusMeters;
    }

    /**
     * Haversine distance in meters between two points.
     */
    public function haversineDistance(
        float $lat1,
        float $lon1,
        float $lat2,
        float $lon2
    ): float {
        $lat1 = deg2rad($lat1);
        $lon1 = deg2rad($lon1);
        $lat2 = deg2rad($lat2);
        $lon2 = deg2rad($lon2);

        $dLat = $lat2 - $lat1;
        $dLon = $lon2 - $lon1;

        $a = sin($dLat / 2) ** 2
            + cos($lat1) * cos($lat2) * sin($dLon / 2) ** 2;
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return self::EARTH_RADIUS_METERS * $c;
    }
}
