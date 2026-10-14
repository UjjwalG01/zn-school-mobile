import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  clearTenant,
  getSession,
  resetSessionForTests,
  restoreSession,
  selectTenant,
  setShells,
  startSession,
} from '../session';
import { saveTokens } from '../tokenStore';

const mockSecure = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(async (key: string, value: string) => void mockSecure.set(key, value)),
  getItemAsync: jest.fn(async (key: string) => mockSecure.get(key) ?? null),
  deleteItemAsync: jest.fn(async (key: string) => void mockSecure.delete(key)),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('session store', () => {
  beforeEach(async () => {
    mockSecure.clear();
    await AsyncStorage.clear();
    resetSessionForTests();
  });

  it('cold start without tokens → signed out', async () => {
    await restoreSession();
    expect(getSession().status).toBe('signed-out');
  });

  it('cold start with tokens → signed in on the persisted school and shell (no network)', async () => {
    await saveTokens({ accessToken: 'a', refreshToken: 'r' });
    await AsyncStorage.setItem('zn-context', JSON.stringify({ tenantId: 't1', shell: 'teacher' }));
    await restoreSession();
    expect(getSession()).toMatchObject({ status: 'signed-in', tenantId: 't1', shell: 'teacher' });
  });

  it('ignores a corrupt persisted context', async () => {
    await saveTokens({ accessToken: 'a', refreshToken: 'r' });
    await AsyncStorage.setItem('zn-context', '{not json');
    await restoreSession();
    expect(getSession()).toMatchObject({ status: 'signed-in', tenantId: null, shell: null });
  });

  it('a school switch resets the shell; re-selecting the same school keeps it', () => {
    startSession();
    selectTenant('t1');
    setShells(['teacher', 'guardian'], 'guardian');
    selectTenant('t1');
    expect(getSession().shell).toBe('guardian');
    selectTenant('t2');
    expect(getSession()).toMatchObject({ tenantId: 't2', shell: null, shells: [] });
  });

  it('persists the selection (non-secret) and clears it with the tenant', async () => {
    startSession();
    selectTenant('t1');
    setShells(['teacher'], 'teacher');
    await new Promise<void>((resolve) => setImmediate(() => resolve()));
    expect(JSON.parse((await AsyncStorage.getItem('zn-context')) ?? '{}')).toEqual({
      tenantId: 't1',
      shell: 'teacher',
    });
    clearTenant();
    await new Promise<void>((resolve) => setImmediate(() => resolve()));
    expect(JSON.parse((await AsyncStorage.getItem('zn-context')) ?? '{}')).toEqual({
      tenantId: null,
      shell: null,
    });
  });
});
