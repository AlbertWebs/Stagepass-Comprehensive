/** Wall-clock shift hours from check-in (matches server AttendanceOvertimeService: 8h standard cap, rest extra). */
export const STANDARD_WORK_MINUTES = 480;

export type ShiftHoursStatus = 'within_standard' | 'in_extra_hours';

export function computeWallClockShiftHours(checkinIso: string | undefined, nowMs: number): {
  totalHours: number;
  standardHours: number;
  extraHours: number;
  status: ShiftHoursStatus;
} {
  if (!checkinIso) {
    return { totalHours: 0, standardHours: 0, extraHours: 0, status: 'within_standard' };
  }
  const start = new Date(checkinIso).getTime();
  if (!Number.isFinite(start)) {
    return { totalHours: 0, standardHours: 0, extraHours: 0, status: 'within_standard' };
  }
  const minutes = Math.max(0, Math.floor((nowMs - start) / 60000));
  const totalHours = minutes / 60;
  const standardMins = Math.min(minutes, STANDARD_WORK_MINUTES);
  const standardHours = standardMins / 60;
  const extraHours = Math.max(0, (minutes - STANDARD_WORK_MINUTES) / 60);
  const status: ShiftHoursStatus = minutes < STANDARD_WORK_MINUTES ? 'within_standard' : 'in_extra_hours';
  return { totalHours, standardHours, extraHours, status };
}
