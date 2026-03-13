<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class TimeOffRequestAttachment extends Model
{
    protected $fillable = ['time_off_request_id', 'path', 'original_name'];

    public function timeOffRequest(): BelongsTo
    {
        return $this->belongsTo(TimeOffRequest::class);
    }

    public function getUrlAttribute(): string
    {
        return Storage::disk('local')->url($this->path);
    }
}
