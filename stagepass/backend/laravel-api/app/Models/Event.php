<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Event extends Model
{
    use HasFactory;

    public const STATUS_CREATED = 'created';
    public const STATUS_ACTIVE = 'active';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_CLOSED = 'closed';
    public const STATUS_DONE_FOR_DAY = 'done_for_the_day';

    protected $fillable = [
        'name', 'description', 'date', 'end_date', 'start_time', 'expected_end_time',
        'location_name', 'latitude', 'longitude', 'geofence_radius', 'daily_allowance',
        'team_leader_id', 'client_id', 'status', 'created_by_id',
        'ended_at', 'ended_by_id', 'end_comment',
        'closed_at', 'closed_by', 'closing_comment',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'end_date' => 'date',
            'geofence_radius' => 'integer',
            'daily_allowance' => 'decimal:2',
            'ended_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    /**
     * Scope: event spans the given date (single-day or multi-day).
     * Single-day: date = $date. Multi-day: date <= $date <= end_date.
     */
    public function scopeSpansDate($query, string $date)
    {
        return $query->where('date', '<=', $date)
            ->where(function ($q) use ($date) {
                $q->where(function ($q2) use ($date) {
                    $q2->whereNull('end_date')->where('date', $date);
                })->orWhere(function ($q2) use ($date) {
                    $q2->whereNotNull('end_date')->where('end_date', '>=', $date);
                });
            });
    }

    /**
     * Scope: event overlaps the date range [from, to] (at least one day in range).
     */
    public function scopeSpansRange($query, string $from, string $to)
    {
        return $query->where('date', '<=', $to)
            ->whereRaw('COALESCE(end_date, date) >= ?', [$from]);
    }

    /**
     * Whether this event's date range overlaps another event's date range.
     * Used to prevent double-booking crew (they can still be transferred between events).
     */
    public function overlapsWith(Event $other): bool
    {
        if ($this->id === $other->id) {
            return true;
        }
        $thisEnd = $this->end_date ? $this->end_date->format('Y-m-d') : $this->date->format('Y-m-d');
        $otherEnd = $other->end_date ? $other->end_date->format('Y-m-d') : $other->date->format('Y-m-d');
        return $this->date->format('Y-m-d') <= $otherEnd && $other->date->format('Y-m-d') <= $thisEnd;
    }

    public function teamLeader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'team_leader_id');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_id');
    }

    public function endedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'ended_by_id');
    }

    public function closedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }

    public function crew(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'event_user')
            ->withPivot(
                'role_in_event',
                'checkin_time',
                'checkout_time',
                'total_hours',
                'extra_hours',
                'is_sunday',
                'is_holiday',
                'holiday_name',
                'checkin_latitude',
                'checkin_longitude',
                'is_paused',
                'pause_start_time',
                'pause_end_time',
                'pause_duration',
                'paused_by',
                'pause_reason',
                'transport_type',
                'transport_amount',
                'transport_recorded_by',
                'transport_recorded_at'
            )
            ->withTimestamps();
    }

    public function eventCrew(): HasMany
    {
        return $this->hasMany(EventUser::class);
    }

    public function meals(): HasMany
    {
        return $this->hasMany(EventMeal::class);
    }

    public function expenses(): HasMany
    {
        return $this->hasMany(EventExpense::class);
    }

    public function equipment(): BelongsToMany
    {
        return $this->belongsToMany(Equipment::class, 'event_equipment')
            ->withPivot('confirmed_by', 'confirmed_at', 'notes')
            ->withTimestamps();
    }

    public function eventEquipment(): HasMany
    {
        return $this->hasMany(EventEquipment::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(EventPayment::class);
    }

    public function notes(): HasMany
    {
        return $this->hasMany(EventNote::class);
    }

    public function checklistItems(): HasMany
    {
        return $this->hasMany(EventChecklistItem::class)->orderBy('sort_order')->orderBy('id');
    }

    public function eventVehicles(): HasMany
    {
        return $this->hasMany(EventVehicle::class);
    }

    public function vehicles(): BelongsToMany
    {
        return $this->belongsToMany(Vehicle::class, 'event_vehicle')
            ->withPivot('driver_id', 'notes')
            ->withTimestamps();
    }
}
