import { QueryClient } from '@tanstack/react-query';

import { shouldPersistQuery } from '../queryClient';

/** A real query in a real cache, so the rule is tested against TanStack's own `Query`, not a hand-made look-alike. */
async function queryWith(options: { meta?: Record<string, unknown>; fail?: boolean }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const queryFn = options.fail ? () => Promise.reject(new Error('x')) : () => Promise.resolve('data');
  await client.prefetchQuery({ queryKey: ['t1', 'x'], queryFn, meta: options.meta });
  return client.getQueryCache().find({ queryKey: ['t1', 'x'] })!;
}

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
