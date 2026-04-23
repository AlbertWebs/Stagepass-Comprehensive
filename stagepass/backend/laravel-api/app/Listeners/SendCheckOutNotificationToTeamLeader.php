<?php

namespace App\Listeners;

use App\Events\CrewCheckedOut;
use App\Notifications\CrewCheckedOutNotification;
use Illuminate\Contracts\Queue\ShouldQueue;

class SendCheckOutNotificationToTeamLeader implements ShouldQueue
{
    public function handle(CrewCheckedOut $e): void
    {
        $eventUser = $e->eventUser;
        $session = $e->session;
        $eventModel = $eventUser->event;
        $teamLeader = $eventModel->teamLeader;

        if ($teamLeader) {
            $teamLeader->notify(new CrewCheckedOutNotification($eventUser, $session));
        }
    }
}
