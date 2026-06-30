<?php

namespace App\Support;

use App\Models\Event;
use App\Models\User;

/**
 * Aligns API checks with crew pivot "role in event" (free text from admin) vs events.team_leader_id.
 */
final class EventTeamLeaderGate
{
    public static function pivotRoleLooksLikeTeamLeader(?string $role): bool
    {
        if ($role === null || trim($role) === '') {
            return false;
        }
        $n = strtolower(preg_replace('/\s+/u', ' ', trim($role)));
        $compact = str_replace(' ', '', $n);

        return $n === 'team leader' || $n === 'team_leader' || $compact === 'teamleader';
    }

    /**
     * True if the user is the official team leader, or there is no official assignee and the crew row marks them as Team Leader.
     */
    public static function userIsAssignedOrRosterTeamLeader(Event $event, User $user): bool
    {
        if (filled($event->team_leader_id)) {
            return (int) $event->team_leader_id === (int) $user->id;
        }

        $role = $event->eventCrew()->where('user_id', $user->id)->value('role_in_event');

        return self::pivotRoleLooksLikeTeamLeader($role);
    }

    /**
     * Mirrors EventCrewController::canManageCrew — crew management, delete event, operations.
     */
    public static function userCanManageEvent(Event $event, User $user): bool
    {
        if ($user->hasRole('super_admin') || $user->hasRole('director') || $user->hasRole('admin')) {
            return true;
        }
        if ((int) $event->created_by_id === (int) $user->id) {
            return true;
        }
        if (filled($event->team_leader_id) && (int) $event->team_leader_id === (int) $user->id) {
            return true;
        }
        if ($user->hasRole('team_leader') && blank($event->team_leader_id)) {
            if ((int) $event->created_by_id === (int) $user->id) {
                return true;
            }
            if ($event->crew()->whereKey($user->id)->exists()) {
                return true;
            }
        }
        if (blank($event->team_leader_id)) {
            return self::userIsAssignedOrRosterTeamLeader($event, $user);
        }

        return false;
    }
}
