import AsyncStorage from '@react-native-async-storage/async-storage';
import { dehydrate, QueryClient } from '@tanstack/react-query';

import { selectTenant, startSession } from '../../auth/session';
import { configureCachePersistence, queryPersister, removePersistedTenantQueries, setCacheHydrated, shouldPersistQuery } from '../queryClient';

/** A real query in a real cache, so the rule is tested against TanStack's own `Query`, not a hand-made look-alike. */
async function queryWith(options: { meta?: Record<string, unknown>; fail?: boolean }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const queryFn = options.fail ? () => Promise.reject(new Error('x')) : () => Promise.resolve('data');
  await client.prefetchQuery({ queryKey: ['t1', 'x'], queryFn, meta: options.meta });
  return client.getQueryCache().find({ queryKey: ['t1', 'x'] })!;
}

describe('persisted tenant removal', () => {
  let clients: QueryClient[] = [];
  beforeEach(async () => {
    await AsyncStorage.clear();
    clients = [];
    startSession();
    selectTenant('t1');
    configureCachePersistence({ buster: '1', dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery } });
  });

  it('removes only the selected tenant and preserves other and user queries', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    clients.push(client);
    client.setQueryData(['t1', 'students'], ['a']);
    client.setQueryData(['t2', 'students'], ['b']);
    client.setQueryData(['_user', 'me'], { id: 'u1' });
    const privateQuery = client.getQueryCache().build(client, {
      queryKey: ['t1', 'private'],
      queryFn: async () => ['not persisted'],
      meta: { persist: false },
    });
    privateQuery.setData(['not persisted']);
    await queryPersister.persistClient({
      timestamp: Date.now(),
      buster: '1',
      clientState: dehydrate(client, { shouldDehydrateQuery: shouldPersistQuery }),
    });
    setCacheHydrated();

    await removePersistedTenantQueries(client, 't1');

    const persisted = await queryPersister.restoreClient();
    expect(persisted?.clientState.queries.map((query) => query.queryKey[0])).toEqual(['t2', '_user']);
    expect(client.getQueryData(['t1', 'students'])).toBeUndefined();
    expect(client.getQueryData(['t2', 'students'])).toEqual(['b']);
    expect(client.getQueryData(['_user', 'me'])).toEqual({ id: 'u1' });
  });

  afterEach(() => clients.forEach((client) => client.clear()));

  it('ignores a stale tenant event after the user switches schools', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    clients.push(client);
    client.setQueryData(['t1', 'students'], ['a']);
    client.setQueryData(['t2', 'students'], ['b']);
    setCacheHydrated();
    selectTenant('t2');

    await removePersistedTenantQueries(client, 't1');

    expect(client.getQueryData(['t1', 'students'])).toEqual(['a']);
    expect(client.getQueryData(['t2', 'students'])).toEqual(['b']);
  });

  it('prevents a throttled scheduled persist from reviving wiped tenant data', async () => {
    jest.useFakeTimers();
    try {
      const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
      clients.push(client);
      client.setQueryData(['t1', 'students'], ['stale']);
      client.setQueryData(['t2', 'students'], ['keep']);
      setCacheHydrated();

      queryPersister.persistClient({
        timestamp: Date.now(),
        buster: '1',
        clientState: dehydrate(client, { shouldDehydrateQuery: shouldPersistQuery }),
      });

      const wipePromise = removePersistedTenantQueries(client, 't1');
      jest.runAllTimers();
      await wipePromise;

      const persisted = await queryPersister.restoreClient();
      expect(persisted?.clientState.queries.map((query) => query.queryKey[0])).toEqual(['t2']);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('shouldPersistQuery', () => {
  it('persists a successful query', async () => {
    expect(shouldPersistQuery(await queryWith({}))).toBe(true);
  });

  it('does not persist a failed query', async () => {
    expect(shouldPersistQuery(await queryWith({ fail: true }))).toBe(false);
  });

  it('does not persist a query that opts out with meta.persist = false (other people’s contact details)', async () => {
    expect(shouldPersistQuery(await queryWith({ meta: { persist: false } }))).toBe(false);
  });

  it('keeps persisting a query whose meta says something else, or persist = true', async () => {
    expect(shouldPersistQuery(await queryWith({ meta: { screen: 'home' } }))).toBe(true);
    expect(shouldPersistQuery(await queryWith({ meta: { persist: true } }))).toBe(true);
  });
});
