import { en } from '../en';
import { detectLocale, setLocale, t } from '../index';
import { ne } from '../ne';

describe('i18n', () => {
  afterEach(() => setLocale('en'));

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
});
