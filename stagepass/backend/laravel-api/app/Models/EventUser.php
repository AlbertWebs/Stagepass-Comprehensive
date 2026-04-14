<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EventUser extends Model
{
    protected $table = 'event_user';

    protected $fillable = [
        'event_id', 'user_id', 'role_in_event',
        'checkin_time', 'checkout_time', 'total_hours', 'extra_hours',
        'is_sunday', 'is_holiday', 'holiday_name',
        'is_paused', 'pause_start_time', 'pause_end_time', 'pause_duration', 'paused_by', 'pause_reason',
        'transport_type', 'transport_amount', 'transport_recorded_by', 'transport_recorded_at',
        'checkin_latitude', 'checkin_longitude',
    ];

    protected function casts(): array
    {
        return [
            'checkin_time' => 'datetime',
            'checkout_time' => 'datetime',
            'total_hours' => 'decimal:2',
            'extra_hours' => 'decimal:2',
            'is_sunday' => 'boolean',
            'is_holiday' => 'boolean',
            'is_paused' => 'boolean',
            'pause_start_time' => 'datetime',
            'pause_end_time' => 'datetime',
            'pause_duration' => 'integer',
            'transport_amount' => 'decimal:2',
            'transport_recorded_at' => 'datetime',
        ];
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
