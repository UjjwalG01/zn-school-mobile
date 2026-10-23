import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { onApiEvent } from '../api/events';
import { logout } from './logout';
import { dropSelectedSchool } from './schoolActions';
import { getSession, setBlocked } from './session';

/** Turns API client events into app behavior (API_CONTRACT §4). Renders nothing. */
export function SessionEvents() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const signedIn = () => getSession().status === 'signed-in';
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
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [queryClient]);

  return null;
}
