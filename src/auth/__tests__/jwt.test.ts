import { msUntilExpiry } from '../jwt';

const token = (payload: object) => `h.${btoa(JSON.stringify(payload)).replace(/=+$/, '')}.s`;

describe('msUntilExpiry', () => {
  it('returns the time left from the exp claim', () => {
    expect(msUntilExpiry(token({ exp: 1_000 + 30 }), 1_000 * 1000)).toBe(30_000);
  });

  it('is negative for an expired token', () => {
    expect(msUntilExpiry(token({ exp: 10 }), 20_000)).toBe(-10_000);
  });

  it('is null for anything unreadable (so the caller falls back to reactive refresh)', () => {
    expect(msUntilExpiry('opaque-token')).toBeNull();
    expect(msUntilExpiry('a.!!!.c')).toBeNull();
    expect(msUntilExpiry(token({ sub: 'x' }))).toBeNull();
  });

  it('handles base64url characters', () => {
    const payload = btoa(JSON.stringify({ exp: 5, n: '??>>' })).replace(/\+/g, '-').replace(/\//g, '_');
    expect(msUntilExpiry(`h.${payload}.s`, 0)).toBe(5_000);
  });
});
