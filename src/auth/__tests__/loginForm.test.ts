import { ApiError } from '../../api/errors';
import { classifyIdentifier, loginErrorKey } from '../loginForm';

describe('classifyIdentifier', () => {
  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['teacher@school.edu.np', 'email'],
    ['  teacher@school.edu.np  ', 'email'],
    ['9841234567', 'phone'],
    ['+977 984-123-4567', 'phone'],
    ['teacher@', 'invalid'],
    ['hello', 'invalid'],
  ])('%j → %s', (input, expected) => {
    expect(classifyIdentifier(input)).toBe(expected);
  });
});

describe('loginErrorKey', () => {
  it('maps API_CONTRACT §4 outcomes for the login call', () => {
    expect(loginErrorKey(new ApiError(401, 'x'))).toBe('auth.error.invalidCredentials');
    expect(loginErrorKey(new ApiError(429, 'x'))).toBe('auth.error.tooManyAttempts');
    expect(loginErrorKey(new ApiError(429, 'x', 'AUTH_TOO_MANY_ATTEMPTS'))).toBe(
      'auth.error.tooManyAttempts',
    );
    expect(loginErrorKey(new ApiError(0, 'x', 'NETWORK_ERROR'))).toBe('auth.error.offline');
    expect(loginErrorKey(new ApiError(400, 'x'))).toBe('auth.error.validation');
    expect(loginErrorKey(new ApiError(503, 'x'))).toBe('auth.error.server');
  });

  it('branches on status/errorCode, not message text', () => {
    expect(loginErrorKey(new ApiError(500, 'Invalid credentials'))).toBe('auth.error.server');
  });

  it('falls back to a generic message for non-API errors', () => {
    expect(loginErrorKey(new Error('boom'))).toBe('auth.error.generic');
  });
});
