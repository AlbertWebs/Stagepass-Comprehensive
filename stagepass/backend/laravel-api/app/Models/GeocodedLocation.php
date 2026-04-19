<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GeocodedLocation extends Model
{
    protected $fillable = [
        'google_place_id',
        'address_hash',
        'location_name',
        'latitude',
        'longitude',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'float',
            'longitude' => 'float',
        ];
    }

    /** Normalize for stable hashing (same venue, minor spacing/case differences). */
    public static function normalizeAddress(string $address): string
    {
        $t = trim(preg_replace('/\s+/u', ' ', $address));

        return mb_strtolower($t, 'UTF-8');
    }
}
