import { ApiError, defaultErrorMessage, errorAction, errorActionOf, parseErrorBody } from '../errors';

describe('parseErrorBody', () => {
  it('reads the backend envelope', () => {
    expect(
      parseErrorBody(JSON.stringify({ statusCode: 403, errorCode: 'LICENSE_EXPIRED', message: 'Expired' })),
    ).toEqual({ message: 'Expired', errorCode: 'LICENSE_EXPIRED' });
  });

  it('joins a message array', () => {
    expect(parseErrorBody(JSON.stringify({ message: ['a must be set', 'b must be set'] })).message).toBe(
      'a must be set, b must be set',
    );
  });

  it('falls back to the raw text for non-JSON bodies', () => {
    expect(parseErrorBody('<html>502</html>')).toEqual({ message: '<html>502</html>' });
  });
});

describe('defaultErrorMessage', () => {
  it('has text for every class of status', () => {
    for (const status of [0, 400, 403, 404, 409, 429, 500]) {
      expect(defaultErrorMessage(status).length).toBeGreaterThan(0);
    }
  });
});

describe('errorAction', () => {
  const action = (status: number, code?: string) => errorAction(new ApiError(status, 'x', code));

  it('maps error codes to app behavior (API_CONTRACT §4)', () => {
    expect(action(0, 'NETWORK_ERROR')).toBe('offline');
    expect(action(403, 'TENANT_MEMBERSHIP_NOT_FOUND')).toBe('drop-school');
    expect(action(403, 'TENANT_ACCESS_DENIED')).toBe('school-suspended');
    expect(action(403, 'LICENSE_SUSPENDED')).toBe('license-blocked');
    expect(action(403, 'ENTITLEMENT_DENIED')).toBe('feature-denied');
    expect(action(409, 'CONCURRENCY_VERSION_CONFLICT')).toBe('conflict');
    expect(action(429, 'AUTH_TOO_MANY_ATTEMPTS')).toBe('wait');
    expect(action(400, 'AUTH_CURRENT_PASSWORD_INCORRECT')).toBe('field-error');
    expect(action(404, 'DOCUMENT_NOT_ISSUED')).toBe('not-issued');
  });

  it('treats every 409 as a conflict, including ones without a CONCURRENCY code', () => {
    expect(action(409, 'ATTENDANCE_ALREADY_RECORDED')).toBe('conflict');
    expect(action(409)).toBe('conflict'); // same idempotency key, different body
  });

  it('falls back to the status when there is no specific code', () => {
    expect(action(401)).toBe('session-expired');
    expect(action(403)).toBe('forbidden');
    expect(action(400)).toBe('validation');
    expect(action(503)).toBe('server');
    expect(action(418)).toBe('unknown');
  });

  it('branches on errorCode, not on message text', () => {
    const error = new ApiError(400, 'TENANT_ACCESS_DENIED', undefined);
    expect(errorAction(error)).toBe('validation');
  });
});

describe('errorActionOf', () => {
  it('maps an ApiError like errorAction and anything else to unknown', () => {
    expect(errorActionOf(new ApiError(0, 'x', 'NETWORK_ERROR'))).toBe('offline');
    expect(errorActionOf(new ApiError(403, 'x', 'ENTITLEMENT_DENIED'))).toBe('feature-denied');
    expect(errorActionOf(new Error('boom'))).toBe('unknown');
    expect(errorActionOf(null)).toBe('unknown');
    expect(errorActionOf(undefined)).toBe('unknown');
  });
});
