// Calendar reads. The month and the upcoming list are Daily class (5 min, persisted, wiped on logout and school switch by
// their tenant-prefixed key). Notices are Daily class too: a notice published an hour ago should not wait for six.
import { useQuery } from '@tanstack/react-query';

import { getCalendar, getNotices } from '../../../api/calendar';
import { tenantKey, userKey } from '../../../api/queryKeys';
import { STALE_TIME } from '../../../api/staleTime';
import { useSession } from '../../../auth/session';

/** How far ahead the "Upcoming" list looks (the API reads at most 400 days). */
export const UPCOMING_DAYS = 60;
/** How many notices the calendar screen lists. */
export const NOTICE_COUNT = 5;

export const calendarKey = (tenantId: string | null, from: string, to: string) =>
  tenantId ? tenantKey(tenantId, 'calendar', from, to) : userKey('calendar', 'no-school');
export const noticesKey = (tenantId: string | null) =>
  tenantId ? tenantKey(tenantId, 'notices') : userKey('notices', 'no-school');

/** One window of `GET /calendar`; `enabled = false` keeps the request off (no `calendar.read`). */
export function useCalendarWindow(from: string, to: string, enabled = true) {
  const { tenantId } = useSession();
  return useQuery({
    queryKey: calendarKey(tenantId, from, to),
    queryFn: () => getCalendar(from, to),
    staleTime: STALE_TIME.daily,
    enabled: enabled && tenantId !== null,
  });
}

/** The newest notices this person may read; the server applies the audience and class scope. */
export function useNotices() {
  const { tenantId } = useSession();
  return useQuery({
    queryKey: noticesKey(tenantId),
    queryFn: () => getNotices(NOTICE_COUNT),
    staleTime: STALE_TIME.daily,
    enabled: tenantId !== null,
  });
}
