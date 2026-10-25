// The notification inbox: one query shared by the header bell (the badge) and the list screen, so showing both costs
// one request. Daily class (5 min, persisted, wiped on logout and school switch by its tenant-prefixed key); a new
// notification arrives on the next foreground refetch or a pull, never by polling.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getNotifications, markNotificationRead } from '../../api/notifications';
import { tenantKey, userKey } from '../../api/queryKeys';
import { STALE_TIME } from '../../api/staleTime';
import type { NotificationPage } from '../../api/types/notifications';
import { useSession } from '../../auth/session';
import { t } from '../../i18n';
import { showToast } from '../../lib/toast';
import { applyRead } from './notificationsModel';

/** The newest rows the app lists. */
// shortcut: only the newest 30, no paging; add "older" (page param) if a teacher needs to look further back.
export const NOTIFICATION_PAGE_SIZE = 30;

export const notificationsKey = (tenantId: string | null) =>
  tenantId ? tenantKey(tenantId, 'notifications') : userKey('notifications', 'no-school');

export function useNotifications() {
  const { tenantId } = useSession();
  return useQuery({
    queryKey: notificationsKey(tenantId),
    queryFn: () => getNotifications(NOTIFICATION_PAGE_SIZE),
    staleTime: STALE_TIME.daily,
    enabled: tenantId !== null,
  });
}

/**
 * Marks one row read. The cached page is patched from the server's answer (no refetch); a failure leaves the row unread
 * and says so once. Never retried: the next tap is the retry.
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const { tenantId } = useSession();
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id), // not passed straight through: the mutation adds a second argument
    onSuccess: ({ id, readAt }) => {
      queryClient.setQueryData<NotificationPage>(notificationsKey(tenantId), (page) =>
        page ? applyRead(page, id, readAt) : page,
      );
    },
    onError: () => showToast(t('notifications.markFailed'), 'error'),
  });
}
