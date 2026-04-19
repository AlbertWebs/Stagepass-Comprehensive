<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GeocodedLocation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LocationCacheController extends Controller
{
    /**
     * Resolve coordinates from DB when this place or address was saved before (avoids relying on Maps API for repeat picks).
     */
    public function show(Request $request): JsonResponse
    {
        $placeId = $request->query('place_id');
        $address = $request->query('address');

        if (! is_string($placeId) && ! is_string($address)) {
            return response()->json(['message' => 'place_id or address is required'], 422);
        }

        $row = null;
        if (is_string($placeId) && $placeId !== '') {
            $row = GeocodedLocation::query()->where('google_place_id', $placeId)->first();
        }
        if ($row === null && is_string($address) && $address !== '') {
            $hash = hash('sha256', GeocodedLocation::normalizeAddress($address));
            $row = GeocodedLocation::query()->where('address_hash', $hash)->first();
        }

        if ($row === null) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return response()->json([
            'latitude' => round((float) $row->latitude, 7),
            'longitude' => round((float) $row->longitude, 7),
            'location_name' => $row->location_name,
            'cached' => true,
        ]);
    }

    /**
     * Persist coordinates after a user selects a location (from Places or manual entry flow).
     */
    public function store(Request $request): JsonResponse
    {
        $v = $request->validate([
            'location_name' => 'required|string|max:2000',
            'latitude' => 'required|numeric',
            'longitude' => 'required|numeric',
            'place_id' => 'nullable|string|max:512',
        ]);

        $norm = GeocodedLocation::normalizeAddress($v['location_name']);
        $hash = hash('sha256', $norm);

        $attributes = [
            'location_name' => $v['location_name'],
            'latitude' => $v['latitude'],
            'longitude' => $v['longitude'],
            'address_hash' => $hash,
            'google_place_id' => ! empty($v['place_id']) ? $v['place_id'] : null,
        ];

        if (! empty($v['place_id'])) {
            GeocodedLocation::query()->updateOrCreate(
                ['google_place_id' => $v['place_id']],
                $attributes
            );
        } else {
            GeocodedLocation::query()->updateOrCreate(
                ['address_hash' => $hash],
                $attributes
            );
        }

        return response()->json(['saved' => true]);
    }
}
