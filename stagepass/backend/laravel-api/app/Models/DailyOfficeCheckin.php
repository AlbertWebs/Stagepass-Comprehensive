<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DailyOfficeCheckin extends Model
{
    protected $fillable = [
        'user_id',
        'date',
        'checkin_time',
        'checkout_time',
        'total_hours',
        'extra_hours',
        'is_sunday',
        'is_holiday',
        'holiday_name',
        'latitude',
        'longitude',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'checkin_time' => 'datetime',
            'checkout_time' => 'datetime',
            'total_hours' => 'decimal:2',
            'extra_hours' => 'decimal:2',
            'is_sunday' => 'boolean',
            'is_holiday' => 'boolean',
            'latitude' => 'float',
            'longitude' => 'float',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
