import { QueryClient } from '@tanstack/react-query';

import { removeTenantQueries, tenantKey, USER_SCOPE, userKey } from '../queryKeys';
import { STALE_TIME } from '../staleTime';

describe('query keys', () => {
  it('prefixes tenant keys with the tenantId and user keys with the user scope', () => {
    expect(tenantKey('t1', 'students', { page: 1 })).toEqual(['t1', 'students', { page: 1 }]);
    expect(userKey('me')).toEqual([USER_SCOPE, 'me']);
  });

  it('rejects an empty tenantId', () => {
    expect(() => tenantKey('')).toThrow();
  });

  it('removes only the given school on switch', () => {
    const client = new QueryClient();
    client.setQueryData(tenantKey('t1', 'students'), [1]);
    client.setQueryData(tenantKey('t2', 'students'), [2]);
    client.setQueryData(userKey('me'), { id: 'u' });
    removeTenantQueries(client, 't1');
    expect(client.getQueryData(tenantKey('t1', 'students'))).toBeUndefined();
    expect(client.getQueryData(tenantKey('t2', 'students'))).toEqual([2]);
    expect(client.getQueryData(userKey('me'))).toEqual({ id: 'u' });
    client.clear(); // release gc timers so Jest can exit
  });
});

describe('staleTime classes (api-and-data.md §5)', () => {
  it('matches the reviewed values', () => {
    const minutes = (ms: number) => ms / 60_000;
    expect(minutes(STALE_TIME.reference)).toBe(360);
    expect(minutes(STALE_TIME.daily)).toBe(5);
    expect(minutes(STALE_TIME.financial)).toBe(2);
    expect(minutes(STALE_TIME.results)).toBe(30);
    expect(minutes(STALE_TIME.session)).toBe(15);
  });
});
