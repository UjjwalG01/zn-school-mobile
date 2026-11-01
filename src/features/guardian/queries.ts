// Guardian reads. The children list is Daily class (5 min, persisted, wiped on logout and school switch by its tenant-prefixed key),
// the same class as the teacher's roster. Keys start with the school so a switch can never show another school's children.
import { useQuery } from '@tanstack/react-query';

import { getNotices } from '../../api/calendar';
import {
  getGuardianAdvance,
  getGuardianAttendance,
  getGuardianCalendar,
  getGuardianFees,
  getGuardianResults,
  getGuardianStudent,
  getGuardianStudents,
} from '../../api/portal';
import { tenantKey, userKey } from '../../api/queryKeys';
import { STALE_TIME } from '../../api/staleTime';
import { useSession } from '../../auth/session';
import { monthRange } from './childModel';

export const guardianStudentsKey = (tenantId: string | null) =>
  tenantId ? tenantKey(tenantId, 'guardian', 'students') : userKey('guardian-students', 'no-school');

/** Every child linked to the signed-in guardian in the selected school. Off until a school is selected. */
export function useGuardianStudents() {
  const { tenantId } = useSession();
  return useQuery({
    queryKey: guardianStudentsKey(tenantId),
    queryFn: getGuardianStudents,
    staleTime: STALE_TIME.daily,
    enabled: tenantId !== null,
  });
}

/** A child's profile. Keyed by the school and the child, so a child switch never reads another child's data. */
export function useGuardianStudent(studentId: string | null) {
  const { tenantId } = useSession();
  const ready = tenantId !== null && studentId !== null;
  return useQuery({
    queryKey: tenantKey(tenantId ?? 'none', 'guardian', studentId ?? 'none', 'profile'),
    queryFn: () => getGuardianStudent(studentId!),
    staleTime: STALE_TIME.daily,
    enabled: ready,
  });
}

/** One child's attendance for one `YYYY-MM` month. A month change is a new key, so it refetches. */
export function useGuardianAttendance(studentId: string | null, month: string) {
  const { tenantId } = useSession();
  const { from, to } = monthRange(month);
  const ready = tenantId !== null && studentId !== null;
  return useQuery({
    queryKey: tenantKey(tenantId ?? 'none', 'guardian', studentId ?? 'none', 'attendance', from, to),
    queryFn: () => getGuardianAttendance(studentId!, from, to),
    staleTime: STALE_TIME.daily,
    enabled: ready,
  });
}

/** One child's released results, newest first. Results change rarely, so they use the Results class. */
export function useGuardianResults(studentId: string | null) {
  const { tenantId } = useSession();
  const ready = tenantId !== null && studentId !== null;
  return useQuery({
    queryKey: tenantKey(tenantId ?? 'none', 'guardian', studentId ?? 'none', 'results'),
    queryFn: () => getGuardianResults(studentId!),
    staleTime: STALE_TIME.results,
    enabled: ready,
  });
}

/** How many notices Home and the Notices screen list at most (the server pages; the app shows the newest). */
export const GUARDIAN_NOTICE_COUNT = 30;

/** The guardian calendar for a window. Daily class, keyed by the school and the window. */
export function useGuardianCalendar(from: string, to: string) {
  const { tenantId } = useSession();
  return useQuery({
    queryKey: tenantKey(tenantId ?? 'none', 'guardian', 'calendar', from, to),
    queryFn: () => getGuardianCalendar(from, to),
    staleTime: STALE_TIME.daily,
    enabled: tenantId !== null,
  });
}

/** The notices this guardian may read (the server applies the audience and the child's class scope). */
export function useGuardianNotices() {
  const { tenantId } = useSession();
  return useQuery({
    queryKey: tenantKey(tenantId ?? 'none', 'guardian', 'notices'),
    queryFn: () => getNotices(GUARDIAN_NOTICE_COUNT),
    staleTime: STALE_TIME.daily,
    enabled: tenantId !== null,
  });
}

/** The guardian's own advance, one row or none. Financial class: wiped on sign-out. */
export function useGuardianAdvance() {
  const { tenantId } = useSession();
  return useQuery({
    queryKey: tenantKey(tenantId ?? 'none', 'guardian', 'advance'),
    queryFn: getGuardianAdvance,
    staleTime: STALE_TIME.financial,
    enabled: tenantId !== null,
  });
}

/** One child's fee summary. Money is Financial class (2 min) and is wiped on sign-out with the rest of the school's data. */
export function useGuardianFees(studentId: string | null) {
  const { tenantId } = useSession();
  const ready = tenantId !== null && studentId !== null;
  return useQuery({
    queryKey: tenantKey(tenantId ?? 'none', 'guardian', studentId ?? 'none', 'fees'),
    queryFn: () => getGuardianFees(studentId!),
    staleTime: STALE_TIME.financial,
    enabled: ready,
  });
}
