<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EventExpense extends Model
{
    protected $fillable = [
        'event_id', 'user_id', 'used_company_transport',
        'cab_amount', 'parking_fee',
    ];

    protected function casts(): array
    {
        return [
            'used_company_transport' => 'boolean',
            'cab_amount' => 'decimal:2',
            'parking_fee' => 'decimal:2',
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
