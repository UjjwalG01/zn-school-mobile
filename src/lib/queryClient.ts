import AsyncStorage from '@react-native-async-storage/async-storage';
import { dehydrate, focusManager, type Query, QueryClient } from '@tanstack/react-query';
import type { PersistedClient } from '@tanstack/react-query-persist-client';
import { AppState, type AppStateStatus } from 'react-native';

import { removeTenantQueries } from '../api/queryKeys';
import { STALE_TIME } from '../api/staleTime';
import { getSession } from '../auth/session';

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

const QUERY_CACHE_KEY = 'zn-query-cache';
const PERSIST_THROTTLE_MS = 2000;
let cacheWrite: Promise<void> = Promise.resolve();
let cacheGeneration = 0;
let pendingClient: PersistedClient | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let lastPersistAt = 0;
let hydrationReady: Promise<void> = Promise.resolve();
let finishHydration: (() => void) | null = null;
let persistOptions: {
  buster: string;
  dehydrateOptions: { shouldDehydrateQuery: typeof shouldPersistQuery };
} | null = null;

function enqueueCacheWrite(write: () => Promise<void>): Promise<void> {
  cacheWrite = cacheWrite.catch(() => undefined).then(write);
  return cacheWrite;
}

function cancelPendingPersist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = null;
  pendingClient = null;
}

function schedulePersist(client: PersistedClient): void {
  pendingClient = client;
  if (persistTimer) return;
  const generation = cacheGeneration;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const latest = pendingClient;
    pendingClient = null;
    if (!latest) return;
    lastPersistAt = Date.now();
    void enqueueCacheWrite(() =>
      generation === cacheGeneration
        ? AsyncStorage.setItem(QUERY_CACHE_KEY, JSON.stringify(latest))
        : Promise.resolve(),
    );
  }, Math.max(0, PERSIST_THROTTLE_MS - (Date.now() - lastPersistAt)));
}

export const queryPersister = {
  persistClient: (client: PersistedClient) => schedulePersist(client),
  restoreClient: async () => {
    await cacheWrite.catch(() => undefined);
    const generation = cacheGeneration;
    const stored = await AsyncStorage.getItem(QUERY_CACHE_KEY);
    return generation === cacheGeneration && stored
      ? (JSON.parse(stored) as PersistedClient)
      : undefined;
  },
  removeClient: async () => {
    cacheGeneration += 1;
    cancelPendingPersist();
    await cacheWrite.catch(() => undefined);
    await enqueueCacheWrite(() => AsyncStorage.removeItem(QUERY_CACHE_KEY));
  },
};

export function setCacheHydrated(): void {
  finishHydration?.();
  finishHydration = null;
}

export function configureCachePersistence(options: NonNullable<typeof persistOptions>): void {
  persistOptions = options;
  hydrationReady = new Promise((resolve) => {
    finishHydration = resolve;
  });
}

export async function removePersistedTenantQueries(queryClient: QueryClient, tenantId: string): Promise<void> {
  await hydrationReady;
  if (getSession().status !== 'signed-in' || getSession().tenantId !== tenantId || !persistOptions) return;
  const generation = ++cacheGeneration;
  cancelPendingPersist();
  await cacheWrite.catch(() => undefined);
  if (generation !== cacheGeneration) return;
  removeTenantQueries(queryClient, tenantId);
  const snapshot: PersistedClient = {
    timestamp: Date.now(),
    buster: persistOptions.buster,
    clientState: dehydrate(queryClient, persistOptions.dehydrateOptions),
  };
  await enqueueCacheWrite(() =>
    generation === cacheGeneration
      ? AsyncStorage.setItem(QUERY_CACHE_KEY, JSON.stringify(snapshot))
      : Promise.resolve(),
  );
  lastPersistAt = Date.now();
}

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
