<?php

namespace App\Support;

use App\Models\Event;
use App\Models\User;

/**
 * Resolves the team leader user for an event (official assignee or roster “Team Leader”).
 */
final class EventTeamLeaderResolver
{
    public static function resolve(?Event $event): ?User
    {
        if (! $event) {
            return null;
        }

        if (filled($event->team_leader_id)) {
            return User::query()->find((int) $event->team_leader_id);
        }

        $event->loadMissing('crew');

        foreach ($event->crew as $user) {
            $role = $user->pivot->role_in_event ?? null;
            if (EventTeamLeaderGate::pivotRoleLooksLikeTeamLeader($role)) {
                return $user;
            }
        }

        return null;
    }
}
