import {
  adIsoToBs,
  BS_MAX_YEAR,
  BS_MIN_YEAR,
  bsToAdIso,
  daysInBsMonth,
  formatAlternateDate,
  formatDate,
  formatMonth,
  formatTimestamp,
  shiftIsoDate,
  shiftMonth,
  toIsoDate,
} from '../date';

describe('shiftMonth / formatMonth', () => {
  it('moves by whole months across year ends', () => {
    expect(shiftMonth('2026-10', -1)).toBe('2026-09');
    expect(shiftMonth('2026-10', 1)).toBe('2026-11');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-10', -12)).toBe('2025-10');
    expect(shiftMonth('2026-10', 0)).toBe('2026-10');
  });

  it('leaves a malformed month unchanged', () => {
    expect(shiftMonth('2026-1', 1)).toBe('2026-1');
    expect(shiftMonth('', 1)).toBe('');
    expect(formatMonth('2026-13')).toBe('2026-13');
    expect(formatMonth('nope')).toBe('nope');
  });

  it('names the AD month', () => {
    expect(formatMonth('2026-10')).toBe('October 2026');
    expect(formatMonth('2026-01')).toBe('January 2026');
  });
});

describe('shiftIsoDate', () => {
  it('moves by whole days across month and year ends', () => {
    expect(shiftIsoDate('2026-10-21', -1)).toBe('2026-10-20');
    expect(shiftIsoDate('2026-10-21', 1)).toBe('2026-10-22');
    expect(shiftIsoDate('2026-10-01', -1)).toBe('2026-09-30');
    expect(shiftIsoDate('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftIsoDate('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('knows leap years', () => {
    expect(shiftIsoDate('2024-03-01', -1)).toBe('2024-02-29');
    expect(shiftIsoDate('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('moves by several days, and by zero', () => {
    expect(shiftIsoDate('2026-10-21', -7)).toBe('2026-10-14');
    expect(shiftIsoDate('2026-10-21', 0)).toBe('2026-10-21');
    expect(shiftIsoDate('2026-10-21', -365)).toBe('2025-10-21');
  });

  it('leaves a malformed date unchanged', () => {
    expect(shiftIsoDate('not-a-date', 1)).toBe('not-a-date');
    expect(shiftIsoDate('', 1)).toBe('');
  });
});

describe('formatTimestamp', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date(2024, 3, 13, 12, 0) }); // local time, so the test is timezone-proof
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows only the time for today, zero-padded', () => {
    expect(formatTimestamp(new Date(2024, 3, 13, 9, 5).getTime(), 'gregorian')).toBe('09:05');
    expect(formatTimestamp(new Date(2024, 3, 13, 23, 59).getTime(), 'nepali')).toBe('23:59');
  });

  it('prefixes the date in the tenant calendar for any other day', () => {
    const yesterday = new Date(2024, 3, 12, 18, 30).getTime();
    expect(formatTimestamp(yesterday, 'gregorian')).toBe('2024-04-12 18:30');
    expect(formatTimestamp(yesterday, 'nepali')).toBe('2080-12-30 18:30');
  });
});

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
