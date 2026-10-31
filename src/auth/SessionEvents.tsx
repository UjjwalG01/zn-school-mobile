import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { onApiEvent } from '../api/events';
import { removePersistedTenantQueries } from '../lib/queryClient';
import { logout } from './logout';
import { dropSelectedSchool } from './schoolActions';
import { getSession, setBlocked, subscribeSession } from './session';

/** Turns API client events into app behavior (API_CONTRACT §4). Renders nothing. */
export function SessionEvents() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const signedIn = () => getSession().status === 'signed-in';
    const forbiddenTenants = new Set<string>();
    let selectedTenantId = getSession().tenantId;
    const unsubscribeSession = subscribeSession(() => {
      const session = getSession();
      if (session.status !== 'signed-in' || session.tenantId !== selectedTenantId) {
        forbiddenTenants.clear();
      }
      selectedTenantId = session.tenantId;
    });
    const unsubscribers = [
      // Refresh was rejected or a replayed request was still 401: the session is over.
      onApiEvent('unauthorized', () => {
        if (signedIn()) void logout(queryClient, { remote: false, notice: 'session-expired' });
      }),
      onApiEvent('tenant-access-lost', () => {
        if (signedIn()) dropSelectedSchool(queryClient);
      }),
      onApiEvent('school-suspended', () => {
        if (signedIn()) setBlocked('suspended');
      }),
      onApiEvent('license-blocked', ({ errorCode }) => {
        if (signedIn()) setBlocked('license', errorCode);
      }),
      onApiEvent('forbidden', ({ tenantId }) => {
        if (!signedIn() || getSession().tenantId !== tenantId || forbiddenTenants.has(tenantId)) return;
        // Keep this tenant guarded until a school/session change so a mounted forbidden query cannot loop.
        forbiddenTenants.add(tenantId);
        void removePersistedTenantQueries(queryClient, tenantId).catch(() => undefined);
      }),
    ];
    return () => {
      unsubscribeSession();
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [queryClient]);

  return null;
}
