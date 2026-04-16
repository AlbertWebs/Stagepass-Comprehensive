import type { Event, User } from '~/services/api';

/** Compare user ids from API/JSON (may be string or number). */
function sameId(a: unknown, b: unknown): boolean {
  if (a === undefined || a === null || b === undefined || b === null) return false;
  const na = Number(a);
  const nb = Number(b);
  if (Number.isNaN(na) || Number.isNaN(nb)) return false;
  return na === nb;
}

function crewHasUser(event: Event, userId: number): boolean {
  return (event.crew ?? []).some((c) => sameId(c.id, userId));
}

/** Mirrors backend EventCrewController::canManageCrew for client-side UI gating. */
export function canManageEventCrew(user: User | null, event: Event | null): boolean {
  if (!user || !event) return false;
  const names = (user.roles ?? []).map((r) => String(r.name || '').toLowerCase());
  if (names.includes('super_admin') || names.includes('director') || names.includes('admin')) {
    return true;
  }
  if (sameId(event.created_by_id, user.id)) {
    return true;
  }
  const leaderId = event.team_leader_id ?? event.team_leader?.id ?? event.teamLeader?.id ?? null;
  const hasAssignedLeader =
    leaderId !== undefined && leaderId !== null && leaderId !== '' && Number(leaderId) !== 0;
  if (hasAssignedLeader && sameId(leaderId, user.id)) {
    return true;
  }
  if (names.includes('team_leader') || names.includes('teamleader')) {
    const noAssignedLeader = !hasAssignedLeader;
    if (noAssignedLeader) {
      if (sameId(event.created_by_id, user.id)) return true;
      if (crewHasUser(event, user.id)) return true;
    }
  }
  return false;
}
