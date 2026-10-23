// Smallest i18n that supports interpolation (UI_SYSTEM §4). The language starts as the device's, and the person can
// change it in Profile (`chooseLocale`, remembered on the device). Plurals are added when a screen needs them.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { en, type MessageKey } from './en';
import { ne } from './ne';

export type { MessageKey } from './en';
export type Locale = 'en' | 'ne';

const catalogs: Record<Locale, Record<MessageKey, string>> = { en, ne };

/** The languages the app offers, each named in its own script (never translated, so it can always be found). */
export const LOCALES: readonly { value: Locale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ne', label: 'नेपाली' },
];

/** AsyncStorage key of the person's choice. A device preference, not an account or school fact: sign-out keeps it. */
export const LOCALE_STORAGE_KEY = 'zn-locale';

export function detectLocale(tag: string | undefined): Locale {
  return tag?.toLowerCase().startsWith('ne') ? 'ne' : 'en';
}

function deviceLocale(): Locale {
  try {
    return detectLocale(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return 'en';
  }
}

let locale: Locale = deviceLocale();
const listeners = new Set<() => void>();

export const getLocale = (): Locale => locale;

/** Sets the language in memory and tells subscribers (the root re-mounts its content so every string is read again). */
export const setLocale = (next: Locale): void => {
  if (next === locale) return;
  locale = next;
  for (const listener of [...listeners]) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The current language, re-read when it changes. */
export const useLocale = (): Locale => useSyncExternalStore(subscribe, getLocale, getLocale);

const isLocale = (value: string | null): value is Locale => value === 'en' || value === 'ne';

/** Applies a language and remembers it on the device. Storage failing only means the choice is not remembered. */
export async function chooseLocale(next: Locale): Promise<void> {
  setLocale(next);
  try {
    await AsyncStorage.setItem(LOCALE_STORAGE_KEY, next);
  } catch {
    // The language is applied for this run; it will be the device's again on the next start.
  }
}

/** Cold start: restores the remembered language, if any. Never throws; a missing or unreadable value keeps the device's. */
export async function loadStoredLocale(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) setLocale(stored);
  } catch {
    // Keep the device's language.
  }
}

/** `t('key', { name })` replaces `{name}` in the string. Falls back to English, then the key. */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const template = catalogs[locale][key] ?? en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
