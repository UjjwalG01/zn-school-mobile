import { ApiError } from '../../api/errors';
import { activateErrorKey } from '../activationForm';

describe('activateErrorKey', () => {
  it('a wrong, unknown or expired code shows one message', () => {
    expect(activateErrorKey(new ApiError(400, 'x', 'ACTIVATION_CODE_INVALID'))).toBe('activate.error.codeInvalid');
  });

  it('an existing account is asked for its current password', () => {
    expect(activateErrorKey(new ApiError(400, 'x', 'ACTIVATION_PASSWORD_REQUIRED'))).toBe(
      'activate.error.currentPasswordRequired',
    );
  });

  it('a throttle, a server error and a dropped connection map to the shared messages', () => {
    expect(activateErrorKey(new ApiError(429, 'x', 'AUTH_TOO_MANY_ATTEMPTS'))).toBe('auth.error.tooManyAttempts');
    expect(activateErrorKey(new ApiError(500, 'x'))).toBe('auth.error.server');
    expect(activateErrorKey(new TypeError('Network request failed'))).toBe('auth.error.generic');
  });
});
