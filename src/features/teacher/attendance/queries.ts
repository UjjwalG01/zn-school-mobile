// Attendance reads. Roster is Daily class (5 min, persisted, wiped on logout and school switch by
// its tenant-prefixed key); the school's status settings are Reference class (6 h). No new class.
import { useQuery } from '@tanstack/react-query';

import { getAttendanceRoster, getAttendanceSettings, type RosterQuery } from '../../../api/attendance';
import { tenantKey, userKey } from '../../../api/queryKeys';
import { STALE_TIME } from '../../../api/staleTime';
import { useSession } from '../../../auth/session';

export const attendanceRosterKey = (tenantId: string | null, query: RosterQuery) =>
  tenantId
    ? tenantKey(tenantId, 'attendance', 'roster', query.date, query.classId, query.sectionId ?? 'none')
    : userKey('attendance-roster', 'no-school');

export const attendanceSettingsKey = (tenantId: string | null) =>
  tenantId ? tenantKey(tenantId, 'attendance', 'settings') : userKey('attendance-settings', 'no-school');

/**
 * The status labels if some other screen has already loaded them, and never a request of its own: the Dashboard chart
 * has a one-request budget (api-and-data §4), so it uses the school's wording when it is cached and the app's otherwise.
 */
export function useCachedAttendanceSettings() {
  const { tenantId } = useSession();
  return useQuery({
    queryKey: attendanceSettingsKey(tenantId),
    queryFn: getAttendanceSettings,
    staleTime: STALE_TIME.reference,
    enabled: false,
  }).data;
}

/** `query = null` (a route without a class) keeps the request off. Served by the primary database. */
export function useAttendanceRoster(query: RosterQuery | null) {
  const { tenantId } = useSession();
  return useQuery({
    queryKey: query ? attendanceRosterKey(tenantId, query) : userKey('attendance-roster', 'no-class'),
    queryFn: () => getAttendanceRoster(query!),
    staleTime: STALE_TIME.daily,
    enabled: tenantId !== null && query !== null,
  });
}

/** Status labels, short codes and active flags: render statuses from this, never a hardcoded list. */
export function useAttendanceSettings() {
  const { tenantId } = useSession();
  return useQuery({
    queryKey: attendanceSettingsKey(tenantId),
    queryFn: getAttendanceSettings,
    staleTime: STALE_TIME.reference,
    enabled: tenantId !== null,
  });
}
