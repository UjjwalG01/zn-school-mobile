import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen, waitFor } from '@testing-library/react-native';

import RootLayout from '../app/_layout';
import { getLocale, LOCALE_STORAGE_KEY, setLocale } from '../src/i18n';

const mockMounts = { stack: 0 };
jest.mock('../src/bootstrap', () => ({}));
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    Stack: () => {
      // Counts how often the navigator is created, to prove a language change re-mounts it.
      useEffect(() => {
        mockMounts.stack += 1;
      }, []);
      return null;
    },
  };
});
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('../src/providers/QueryProvider', () => ({ QueryProvider: ({ children }: { children: unknown }) => children }));
jest.mock('../src/auth/SessionEvents', () => ({ SessionEvents: () => null }));
jest.mock('../src/components/ToastHost', () => ({ ToastHost: () => null }));
jest.mock('../src/auth/session', () => ({ restoreSession: jest.fn() }));

beforeEach(async () => {
  mockMounts.stack = 0;
  setLocale('en');
  await AsyncStorage.clear();
});

describe('RootLayout language', () => {
  it('opens in the remembered language, not the device’s, before the first screen', async () => {
    await AsyncStorage.setItem(LOCALE_STORAGE_KEY, 'ne');
    await render(<RootLayout />);

    await waitFor(() => expect(mockMounts.stack).toBe(1));
    expect(getLocale()).toBe('ne');
  });

  it('keeps the device’s language when nothing is remembered, and mounts the navigator once', async () => {
    await render(<RootLayout />);

    await waitFor(() => expect(mockMounts.stack).toBe(1));
    expect(getLocale()).toBe('en');
  });

  it('re-mounts the navigator when the language changes, so every screen reads its strings again', async () => {
    await render(<RootLayout />);
    await waitFor(() => expect(mockMounts.stack).toBe(1));

    await act(async () => setLocale('ne'));
    await waitFor(() => expect(mockMounts.stack).toBe(2));

    // Setting the language it already has changes nothing.
    await act(async () => setLocale('ne'));
    expect(mockMounts.stack).toBe(2);
    expect(screen.toJSON()).toBeNull();
  });
});
