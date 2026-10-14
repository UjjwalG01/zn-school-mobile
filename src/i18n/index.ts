// Smallest i18n that supports interpolation (UI_SYSTEM §4). Locale comes from the device; an
// in-app language switch (and plurals) is added when a screen needs it.
import { en, type MessageKey } from './en';
import { ne } from './ne';

export type { MessageKey } from './en';
export type Locale = 'en' | 'ne';

const catalogs: Record<Locale, Record<MessageKey, string>> = { en, ne };

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

export const getLocale = (): Locale => locale;
export const setLocale = (next: Locale): void => {
  locale = next;
};

/** `t('key', { name })` replaces `{name}` in the string. Falls back to English, then the key. */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const template = catalogs[locale][key] ?? en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
