<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReminderLog extends Model
{
    public const TYPE_ADDED = 'added';
    public const TYPE_EVENT_NEAR = 'event_near';
    public const TYPE_CHECKIN_DUE = 'checkin_due';

    public const CHANNEL_EMAIL = 'email';
    public const CHANNEL_SMS = 'sms';

    protected $fillable = ['event_id', 'user_id', 'type', 'channel', 'sent_at'];

    protected function casts(): array
    {
        return ['sent_at' => 'datetime'];
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function wasSent(int $eventId, int $userId, string $type, string $channel): bool
    {
        return self::where('event_id', $eventId)
            ->where('user_id', $userId)
            ->where('type', $type)
            ->where('channel', $channel)
            ->exists();
    }

    public static function logSent(int $eventId, int $userId, string $type, string $channel): void
    {
        self::create([
            'event_id' => $eventId,
            'user_id' => $userId,
            'type' => $type,
            'channel' => $channel,
            'sent_at' => now(),
        ]);
    }
}
