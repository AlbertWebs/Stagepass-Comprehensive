<?php

namespace App\Events;

use App\Models\EventUser;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CrewCheckedIn
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public EventUser $eventUser
    ) {}
}
