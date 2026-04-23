<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EventAttendanceSession extends Model
{
    protected $table = 'event_attendance_sessions';

    protected $fillable = [
        'event_id', 'user_id', 'work_date', 'checkin_time', 'checkout_time',
        'total_hours', 'standard_hours', 'extra_hours', 'is_sunday', 'is_holiday', 'holiday_name',
        'pause_duration', 'checkin_latitude', 'checkin_longitude',
    ];

    protected function casts(): array
    {
        return [
            'work_date' => 'date',
            'checkin_time' => 'datetime',
            'checkout_time' => 'datetime',
            'total_hours' => 'decimal:2',
            'standard_hours' => 'decimal:2',
            'extra_hours' => 'decimal:2',
            'is_sunday' => 'boolean',
            'is_holiday' => 'boolean',
            'pause_duration' => 'integer',
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
