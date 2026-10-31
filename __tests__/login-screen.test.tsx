import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { login } from '../src/api/identity';
import { ApiError } from '../src/api/errors';
import { saveTokens } from '../src/auth/tokenStore';
import { endSession, getSession, resetSessionForTests } from '../src/auth/session';
import LoginScreen from '../app/(auth)/login';

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush, back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));
jest.mock('../src/api/identity', () => ({ login: jest.fn() }));
jest.mock('../src/auth/tokenStore', () => ({
  saveTokens: jest.fn(async () => undefined),
  loadTokens: jest.fn(),
}));
jest.mock('../src/auth/tenantStore', () => ({ loadContext: jest.fn(), saveContext: jest.fn() }));

const mockLogin = login as jest.Mock;
const mockSave = saveTokens as jest.Mock;

async function fill(identifier: string, password: string) {
  await fireEvent.changeText(screen.getByLabelText('Phone or email'), identifier);
  await fireEvent.changeText(screen.getByLabelText('Password'), password);
}

describe('Login screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetSessionForTests();
    endSession();
  });

  it('explains a forced logout (expired session)', async () => {
    endSession('session-expired');
    await render(<LoginScreen />);
    expect(screen.getByText('Your session has expired. Please sign in again.')).toBeTruthy();
  });

  it('shows school-neutral branding, both fields and the activate link', async () => {
    await render(<LoginScreen />);
    expect(screen.getByText('Orbis Education')).toBeTruthy();
    expect(screen.getByLabelText('Phone or email')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in with your school' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Activate account' }));
    expect(mockPush).toHaveBeenCalledWith('/activate');
  });

  it('toggles password visibility', async () => {
    await render(<LoginScreen />);
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Show Password' }));
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);
  });

  it('sends a phone number as the identifier, as typed', async () => {
    mockLogin.mockResolvedValueOnce({ accessToken: 'a', refreshToken: 'r' });
    await render(<LoginScreen />);
    await fill('9841234567', 'secret123');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in with your school' }));
    expect(mockLogin).toHaveBeenCalledWith('9841234567', 'secret123');
  });

  it('requires both fields', async () => {
    await render(<LoginScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in with your school' }));
    expect(screen.getByText('Enter your phone or email.')).toBeTruthy();
    expect(screen.getByText('Enter your password.')).toBeTruthy();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('stores tokens, starts the session and routes to the resolve gate on success', async () => {
    mockLogin.mockResolvedValueOnce({ accessToken: 'a', refreshToken: 'r' });
    await render(<LoginScreen />);
    await fill(' teacher@school.np ', 'secret123');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in with your school' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/resolve'));
    expect(getSession().status).toBe('signed-in');
    expect(mockLogin).toHaveBeenCalledWith('teacher@school.np', 'secret123');
    expect(mockSave).toHaveBeenCalledWith({ accessToken: 'a', refreshToken: 'r' });
  });

  it('shows the invalid-credentials message on 401 and stays on the screen', async () => {
    mockLogin.mockRejectedValueOnce(new ApiError(401, 'Unauthorized'));
    await render(<LoginScreen />);
    await fill('teacher@school.np', 'wrong');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in with your school' }));
    expect(await screen.findByText('Incorrect email or password. Please try again.')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows the wait message on 429', async () => {
    mockLogin.mockRejectedValueOnce(new ApiError(429, 'x', 'AUTH_TOO_MANY_ATTEMPTS'));
    await render(<LoginScreen />);
    await fill('teacher@school.np', 'pw');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in with your school' }));
    expect(await screen.findByText(/Too many attempts/)).toBeTruthy();
  });

  it('does not route home when the session cannot be saved', async () => {
    mockLogin.mockResolvedValueOnce({ accessToken: 'a', refreshToken: 'r' });
    mockSave.mockRejectedValueOnce(new Error('keystore'));
    await render(<LoginScreen />);
    await fill('teacher@school.np', 'pw');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in with your school' }));
    expect(await screen.findByText(/Could not save your session/)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(getSession().status).toBe('signed-out');
  });

  it('ignores a second press while a request is in flight', async () => {
    let resolve!: (v: unknown) => void;
    mockLogin.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    await render(<LoginScreen />);
    await fill('teacher@school.np', 'pw');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in with your school' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in with your school' }));
    expect(mockLogin).toHaveBeenCalledTimes(1);
    resolve({ accessToken: 'a', refreshToken: 'r' });
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
  });
});
