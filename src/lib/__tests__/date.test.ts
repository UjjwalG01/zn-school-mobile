import {
  adIsoToBs,
  BS_MAX_YEAR,
  BS_MIN_YEAR,
  bsToAdIso,
  daysInBsMonth,
  formatAlternateDate,
  formatDate,
  toIsoDate,
} from '../date';

describe('date module', () => {
  it('uses the local date parts, not UTC', () => {
    expect(toIsoDate(new Date(2024, 3, 13, 23, 59))).toBe('2024-04-13');
  });

  it('converts AD to BS (Baisakh 1, 2081 = 2024-04-13; month is 0-indexed)', () => {
    expect(adIsoToBs('2024-04-13')).toEqual({ year: 2081, month: 0, date: 1 });
  });

  it('round-trips BS to AD', () => {
    expect(bsToAdIso(2081, 0, 1)).toBe('2024-04-13');
  });

  it('exposes the converter bounds instead of hardcoding them', () => {
    expect(BS_MIN_YEAR).toBe(2000);
    expect(BS_MAX_YEAR).toBe(2090);
    expect(daysInBsMonth(2081, 0)).toBeGreaterThanOrEqual(29);
  });

  it('formats in the tenant calendar as YYYY-MM-DD', () => {
    expect(formatDate('2024-04-13', 'gregorian')).toBe('2024-04-13');
    expect(formatDate('2024-04-13', 'nepali')).toBe('2081-01-01');
  });

  it('falls back to AD outside the BS range or for malformed input', () => {
    expect(formatDate('1900-01-01', 'nepali')).toBe('1900-01-01');
    expect(formatDate('not-a-date', 'nepali')).toBe('not-a-date');
  });

  it('gives the alternate calendar text for the secondary line', () => {
    expect(formatAlternateDate('2024-04-13', 'gregorian')).toBe('2081-01-01');
    expect(formatAlternateDate('2024-04-13', 'nepali')).toBe('2024-04-13');
    expect(formatAlternateDate('1900-01-01', 'gregorian')).toBeNull();
  });
});
