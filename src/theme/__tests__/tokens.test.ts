import { darkColors, lightColors, MIN_TOUCH_TARGET, radius, withAlpha } from '../tokens';

describe('theme tokens', () => {
  it('defines the same keys in light and dark', () => {
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(lightColors).sort());
  });

  it('uses 6-digit hex colors only', () => {
    for (const value of [...Object.values(lightColors), ...Object.values(darkColors)]) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('mirrors the web light palette (UI_SYSTEM §1)', () => {
    expect(lightColors).toMatchObject({
      bg: '#f5f6f8',
      card: '#ffffff',
      header: '#1c2131',
      brand: '#1e3a8a',
      text: '#282a2e',
      accent: '#2563eb',
      border: '#e0e0e0',
    });
    expect(radius.lg).toBe(8);
  });

  it('builds a tint from a palette colour', () => {
    expect(withAlpha('#2563eb', 1)).toBe('#2563ebff');
    expect(withAlpha('#2563eb', 0.5)).toBe('#2563eb80');
    expect(withAlpha('#2563eb', 0)).toBe('#2563eb00');
    expect(withAlpha('#2563eb', 7)).toBe('#2563ebff'); // clamped
  });

  it('keeps the accessibility touch target at 44pt', () => {
    expect(MIN_TOUCH_TARGET).toBe(44);
  });
});
