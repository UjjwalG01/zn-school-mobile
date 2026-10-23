import AsyncStorage from '@react-native-async-storage/async-storage';

import { en } from '../en';
import { chooseLocale, detectLocale, getLocale, loadStoredLocale, LOCALE_STORAGE_KEY, setLocale, t } from '../index';
import { ne } from '../ne';

describe('i18n', () => {
  afterEach(async () => {
    setLocale('en');
    await AsyncStorage.clear();
  });

  it('has the same keys in en and ne, and no empty strings', () => {
    expect(Object.keys(ne).sort()).toEqual(Object.keys(en).sort());
    for (const value of [...Object.values(en), ...Object.values(ne)]) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });

  it('detects Nepali from the device locale and defaults to English', () => {
    expect(detectLocale('ne-NP')).toBe('ne');
    expect(detectLocale('en-US')).toBe('en');
    expect(detectLocale(undefined)).toBe('en');
  });

  it('translates by locale', () => {
    expect(t('auth.submit')).toBe('Sign in');
    setLocale('ne');
    expect(t('auth.submit')).toBe(ne['auth.submit']);
  });

  it('keeps every interpolation placeholder when it is translated', () => {
    const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
    const mismatched = (Object.keys(en) as (keyof typeof en)[]).filter(
      (key) => placeholders(en[key]).join() !== placeholders(ne[key]).join(),
    );
    expect(mismatched).toEqual([]);
  });

  describe('the person’s choice', () => {
    it('applies a chosen language and remembers it on the device', async () => {
      await chooseLocale('ne');
      expect(getLocale()).toBe('ne');
      expect(await AsyncStorage.getItem(LOCALE_STORAGE_KEY)).toBe('ne');
    });

    it('restores the remembered language on a cold start', async () => {
      await AsyncStorage.setItem(LOCALE_STORAGE_KEY, 'ne');
      await loadStoredLocale();
      expect(getLocale()).toBe('ne');
    });

    it('ignores a missing, unknown or unreadable value and keeps the current language', async () => {
      await loadStoredLocale();
      expect(getLocale()).toBe('en');

      await AsyncStorage.setItem(LOCALE_STORAGE_KEY, 'fr');
      await loadStoredLocale();
      expect(getLocale()).toBe('en');

      jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('storage down'));
      await expect(loadStoredLocale()).resolves.toBeUndefined();
      expect(getLocale()).toBe('en');
    });

    it('still applies the language when it cannot be written', async () => {
      jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('storage full'));
      await expect(chooseLocale('ne')).resolves.toBeUndefined();
      expect(getLocale()).toBe('ne');
    });
  });
});
