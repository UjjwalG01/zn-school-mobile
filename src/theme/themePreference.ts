// The person's light / dark choice (Profile). Same shape as the language choice in `src/i18n`: a device preference, kept in
// AsyncStorage (not secret, not part of the account or the school), read before the first screen, and kept on sign-out.
// `Appearance.setColorScheme` makes `useColorScheme` (so `useTheme`) and the native chrome (alerts, keyboard) follow it,
// so no screen needs to know about the preference; `'unspecified'` hands the decision back to the device.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];

export const THEME_STORAGE_KEY = 'zn-theme';

let preference: ThemePreference = 'system';
const listeners = new Set<() => void>();

export const getThemePreference = (): ThemePreference => preference;

/** Applies the choice in memory and to the native scheme, and tells subscribers. */
export function setThemePreference(next: ThemePreference): void {
  preference = next;
  Appearance.setColorScheme(next === 'system' ? 'unspecified' : next);
  for (const listener of [...listeners]) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useThemePreference = (): ThemePreference =>
  useSyncExternalStore(subscribe, getThemePreference, getThemePreference);

const isPreference = (value: string | null): value is ThemePreference =>
  THEME_PREFERENCES.some((candidate) => candidate === value);

/** Applies a choice and remembers it. Storage failing only means the choice is not remembered. */
export async function chooseTheme(next: ThemePreference): Promise<void> {
  setThemePreference(next);
  try {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Applied for this run; the device's scheme is used again on the next start.
  }
}

/** Cold start: restores the remembered choice, if any. Never throws; a missing or unreadable value keeps the device's. */
export async function loadStoredTheme(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
    if (isPreference(stored)) setThemePreference(stored);
  } catch {
    // Keep following the device.
  }
}
