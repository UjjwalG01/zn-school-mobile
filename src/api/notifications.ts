// Typed requests for the caller's own notification inbox (docs/api/API_CONTRACT.md §2; backend ENDPOINTS.md §7f).
// `tenantId` is attached by the client (selected school). Membership only: the server returns this person's rows and
// nobody else's, and answers 404 for another person's id on the read call.
import { apiGet, apiPost } from './client';
import type { NotificationPage } from './types/notifications';

/** `GET /portal/notifications?page=1&pageSize=` — the newest rows first, plus the count of all unread ones. */
export async function getNotifications(pageSize: number): Promise<NotificationPage> {
  const page = await apiGet<NotificationPage>(`/portal/notifications?page=1&pageSize=${pageSize}`);
  return {
    rows: page.rows.map(({ id, type, referenceId, title, readAt, createdAt }) => ({
      id,
      type,
      referenceId,
      title,
      readAt,
      createdAt,
    })),
    total: page.total,
    unread: page.unread,
  };
}

/** `POST /portal/notifications/:id/read` — idempotent; a second call keeps the first read time. */
export const markNotificationRead = (id: string) =>
  apiPost<{ id: string; readAt: string }>(`/portal/notifications/${encodeURIComponent(id)}/read`);
