<?php

namespace App\Listeners;

use App\Events\CrewCheckedIn;
use App\Notifications\CrewCheckedInNotification;
use Illuminate\Contracts\Queue\ShouldQueue;

class SendCheckInNotificationToTeamLeader implements ShouldQueue
{
    public function handle(CrewCheckedIn $event): void
    {
        $eventUser = $event->eventUser;
        $eventModel = $eventUser->event;
        $teamLeader = $eventModel->teamLeader;

        if ($teamLeader) {
            $teamLeader->notify(new CrewCheckedInNotification($eventUser));
        }
    }
}
