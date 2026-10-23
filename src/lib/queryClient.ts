import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { focusManager, type Query, QueryClient } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';

import { STALE_TIME } from '../api/staleTime';

/** Persisted cache lifetime; gcTime must be >= this or entries are collected before they persist. */
export const PERSIST_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** App-foreground refetch is throttled to once per 60 s (ARCHITECTURE §5). */
const FOREGROUND_THROTTLE_MS = 60_000;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME.daily, // safe default; screens choose a class from api/staleTime.ts
        gcTime: PERSIST_MAX_AGE_MS,
        // The API client already retries GETs on network errors; do not multiply requests.
        retry: false,
        // No polling. Foreground refetch only touches stale queries (see setupForegroundRefetch).
      },
      mutations: { retry: false },
    },
  });
}

/**
 * Which queries reach the disk: the successful ones, except a query that sets `meta: { persist: false }`.
 * That is how data about other people (a student's guardians' phone numbers, health data) stays in
 * memory only, and is gone when the app is closed (docs/project/STUDENT_INFO_PLAN.md, SI-D3).
 */
export const shouldPersistQuery = (query: Pick<Query, 'state' | 'meta'>): boolean =>
  query.state.status === 'success' && query.meta?.persist !== false;

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'zn-query-cache',
  throttleTime: 2000,
});

/** Logout (security.md §4): memory + disk. Downloaded PDFs are deleted by the session layer. */
export async function resetPersistedCache(queryClient: QueryClient): Promise<void> {
  queryClient.clear();
  await queryPersister.removeClient();
}

/**
 * Maps RN AppState to TanStack's focusManager so "app came to foreground" refetches stale queries,
 * at most once per 60 s. Call once at startup; the listener lives for the app's lifetime.
 */
export function setupForegroundRefetch(): void {
  let lastFocusedAt = 0;
  focusManager.setEventListener((handleFocus) => {
    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      if (status !== 'active') return handleFocus(false);
      const now = Date.now();
      if (now - lastFocusedAt < FOREGROUND_THROTTLE_MS) return;
      lastFocusedAt = now;
      handleFocus(true);
    });
    return () => subscription.remove();
  });
}
