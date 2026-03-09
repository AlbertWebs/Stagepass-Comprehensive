<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Communication extends Model
{
    public const SCOPE_ALL_STAFF = 'all_staff';

    public const SCOPE_CREW = 'crew';

    public const SCOPE_EVENT_CREW = 'event_crew';

    protected $fillable = [
        'sent_by_id',
        'subject',
        'body',
        'recipient_scope',
        'event_id',
        'send_as_message',
        'send_as_email',
        'sent_at',
    ];

    protected function casts(): array
    {
        return [
            'send_as_message' => 'boolean',
            'send_as_email' => 'boolean',
            'sent_at' => 'datetime',
        ];
    }

    public function sentBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sent_by_id');
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }
}
