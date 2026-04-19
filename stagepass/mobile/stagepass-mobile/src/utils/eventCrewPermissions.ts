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

/** Free-text "Role in event" on the crew pivot (admin dashboard) — not the same as events.team_leader_id. */
export function pivotRoleLooksLikeTeamLeader(role: string | null | undefined): boolean {
  if (role == null || !String(role).trim()) return false;
  const n = String(role)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  const compact = n.replace(/\s/g, '');
  return n === 'team leader' || n === 'team_leader' || compact === 'teamleader';
}

/** Spatie may store "Team Leader", "team_leader", etc. */
function hasTeamLeaderSpatieRole(names: string[]): boolean {
  return names.some((raw) => {
    const n = raw.trim().toLowerCase();
    if (n === 'team_leader' || n === 'teamleader') return true;
    return n.replace(/\s+/g, '') === 'teamleader';
  });
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
  if (hasTeamLeaderSpatieRole(names)) {
    const noAssignedLeader = !hasAssignedLeader;
    if (noAssignedLeader) {
      if (sameId(event.created_by_id, user.id)) return true;
      if (crewHasUser(event, user.id)) return true;
    }
  }
  if (!hasAssignedLeader) {
    const myCrew = (event.crew ?? []).find((c) => sameId(c.id, user.id));
    const pivotRole = (myCrew?.pivot as { role_in_event?: string | null } | undefined)?.role_in_event;
    if (pivotRoleLooksLikeTeamLeader(pivotRole)) {
      return true;
    }
  }
  return false;
}
