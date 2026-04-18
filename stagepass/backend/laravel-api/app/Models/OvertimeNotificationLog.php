<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OvertimeNotificationLog extends Model
{
    protected $fillable = [
        'user_id',
        'context',
        'daily_office_checkin_id',
        'event_user_id',
        'message',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function dailyOfficeCheckin(): BelongsTo
    {
        return $this->belongsTo(DailyOfficeCheckin::class);
    }

    public function eventUser(): BelongsTo
    {
        return $this->belongsTo(EventUser::class);
    }
}
