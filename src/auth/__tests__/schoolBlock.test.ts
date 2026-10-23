import { unavailableBodyKey } from '../schoolBlock';

describe('unavailableBodyKey', () => {
  it('names the license reason the backend gave', () => {
    expect(unavailableBodyKey('license', 'LICENSE_NOT_FOUND')).toBe('unavailable.reason.none');
    expect(unavailableBodyKey('license', 'LICENSE_SUSPENDED')).toBe('unavailable.reason.suspended');
    expect(unavailableBodyKey('license', 'LICENSE_EXPIRED')).toBe('unavailable.reason.expired');
    expect(unavailableBodyKey('license', 'LICENSE_NOT_YET_VALID')).toBe('unavailable.reason.scheduled');
  });

  it('falls back to the generic message without a known reason', () => {
    expect(unavailableBodyKey('license', null)).toBe('unavailable.license');
    expect(unavailableBodyKey('license', 'SOMETHING_ELSE')).toBe('unavailable.license');
  });

  it('a suspended or archived school keeps its own message whatever the reason', () => {
    expect(unavailableBodyKey('suspended', null)).toBe('unavailable.suspended');
    expect(unavailableBodyKey('suspended', 'LICENSE_EXPIRED')).toBe('unavailable.suspended');
  });
});
