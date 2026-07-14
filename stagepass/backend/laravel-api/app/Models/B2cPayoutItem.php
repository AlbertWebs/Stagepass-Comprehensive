<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class B2cPayoutItem extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_QUEUED = 'queued';

    public const STATUS_ACCEPTED = 'accepted';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_FAILED = 'failed';

    public const STATUS_SKIPPED = 'skipped';

    protected $fillable = [
        'b2c_payout_id',
        'user_id',
        'phone',
        'amount',
        'event_allowance_ids',
        'status',
        'conversation_id',
        'originator_conversation_id',
        'transaction_id',
        'result_code',
        'result_desc',
        'raw_response',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'event_allowance_ids' => 'array',
            'raw_response' => 'array',
        ];
    }

    public function payout(): BelongsTo
    {
        return $this->belongsTo(B2cPayout::class, 'b2c_payout_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
