<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EventMeal extends Model
{
    protected $fillable = ['user_id', 'event_id', 'breakfast', 'lunch', 'dinner'];

    protected function casts(): array
    {
        return [
            'breakfast' => 'boolean',
            'lunch' => 'boolean',
            'dinner' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }
}
