import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

import { chooseTheme, getThemePreference, loadStoredTheme, setThemePreference, THEME_STORAGE_KEY } from '../themePreference';

let setScheme: jest.SpyInstance;

beforeEach(async () => {
  setScheme = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => undefined);
  setThemePreference('system');
  setScheme.mockClear();
  await AsyncStorage.clear();
});

afterEach(() => jest.restoreAllMocks());

describe('theme preference', () => {
  it('applies a choice to the native scheme and remembers it on the device', async () => {
    await chooseTheme('dark');

    expect(getThemePreference()).toBe('dark');
    expect(setScheme).toHaveBeenLastCalledWith('dark');
    expect(await AsyncStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('hands the decision back to the device for "system"', async () => {
    await chooseTheme('light');
    await chooseTheme('system');

    expect(setScheme).toHaveBeenLastCalledWith('unspecified');
    expect(await AsyncStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
  });

  it('restores the remembered choice at start', async () => {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, 'light');
    await loadStoredTheme();

    expect(getThemePreference()).toBe('light');
    expect(setScheme).toHaveBeenLastCalledWith('light');
  });

  it('keeps following the device when nothing, or something unknown, was remembered', async () => {
    await loadStoredTheme();
    expect(getThemePreference()).toBe('system');

    await AsyncStorage.setItem(THEME_STORAGE_KEY, 'sepia');
    await loadStoredTheme();
    expect(getThemePreference()).toBe('system');
    expect(setScheme).not.toHaveBeenCalled();
  });

  it('still applies the choice for this run when storage fails', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));
    await chooseTheme('dark');

    expect(getThemePreference()).toBe('dark');
  });
});
