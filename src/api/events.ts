// Replaces the web client's `window.dispatchEvent('zn:*')` events. No React, no globals.

export interface ApiEvents {
  /** Session is over (refresh failed or a replayed request was still 401) → local logout. */
  unauthorized: undefined;
  /** The selected school's membership was removed/deactivated server-side. */
  'tenant-access-lost': undefined;
  /** The selected school is suspended/archived (TENANT_ACCESS_DENIED). */
  'school-suspended': undefined;
  /** The selected school's license blocks every tenant route. */
  'license-blocked': { errorCode: string; message: string };
}

type Listener<K extends keyof ApiEvents> = (payload: ApiEvents[K]) => void;

const listeners: { [K in keyof ApiEvents]: Set<Listener<K>> } = {
  unauthorized: new Set(),
  'tenant-access-lost': new Set(),
  'school-suspended': new Set(),
  'license-blocked': new Set(),
};

/** Subscribe; returns the unsubscribe function. */
export function onApiEvent<K extends keyof ApiEvents>(event: K, listener: Listener<K>): () => void {
  listeners[event].add(listener);
  return () => {
    listeners[event].delete(listener);
  };
}

export function emitApiEvent<K extends keyof ApiEvents>(event: K, payload: ApiEvents[K]): void {
  for (const listener of [...listeners[event]]) listener(payload);
}
