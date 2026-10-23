import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import Constants from 'expo-constants';
import { type ReactNode, useState } from 'react';

import {
  createQueryClient,
  PERSIST_MAX_AGE_MS,
  queryPersister,
  setupForegroundRefetch,
  shouldPersistQuery,
} from '../lib/queryClient';

setupForegroundRefetch();

/** TanStack Query is the only server-state store; the cache persists to disk (ARCHITECTURE §5). */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        maxAge: PERSIST_MAX_AGE_MS,
        // A new app version drops the old cache, so a changed response shape can't hit new code.
        buster: Constants.expoConfig?.version ?? '0',
        dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
