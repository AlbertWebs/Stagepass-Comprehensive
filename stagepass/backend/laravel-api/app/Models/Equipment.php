<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Equipment extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'serial_number', 'condition'];

    public function events(): BelongsToMany
    {
        return $this->belongsToMany(Event::class, 'event_equipment')
            ->withPivot('confirmed_by', 'confirmed_at', 'notes')
            ->withTimestamps();
    }
}
