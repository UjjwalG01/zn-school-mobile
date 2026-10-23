// The ONE toast API for the whole app (docs/frontend/UI_SYSTEM.md §2). A plain store with no React,
// same style as `api/events.ts`, so hooks, mutation callbacks and screens all call `showToast()`.
// `<ToastHost />` (mounted once in app/_layout.tsx) renders it. Callers pass text already run
// through `t()`; never put a student name, mark or token in a toast.

export type ToastTone = 'info' | 'success' | 'error';

export interface ToastMessage {
  /** Changes on every `showToast`, so a repeated message restarts its timer. */
  id: number;
  message: string;
  tone: ToastTone;
}

/** How long a toast stays; errors stay longer. A timer that only hides the toast — it never fetches. */
export const TOAST_DURATION_MS: Record<ToastTone, number> = {
  info: 4000,
  success: 4000,
  error: 6000,
};

type Listener = () => void;

let current: ToastMessage | null = null;
let nextId = 1;
const listeners = new Set<Listener>();

const notify = () => {
  for (const listener of [...listeners]) listener();
};

/** One toast at a time: a new one replaces the one on screen. */
export function showToast(message: string, tone: ToastTone = 'info'): void {
  current = { id: nextId, message, tone };
  nextId += 1;
  notify();
}

/** Hides the toast. With an `id`, only that toast (a stale timer must not hide its successor). */
export function dismissToast(id?: number): void {
  if (!current || (id !== undefined && id !== current.id)) return;
  current = null;
  notify();
}

export const getToast = (): ToastMessage | null => current;

/** Subscribe; returns the unsubscribe function (the shape `useSyncExternalStore` wants). */
export function subscribeToast(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetToastForTests(): void {
  current = null;
  nextId = 1;
  listeners.clear();
}
