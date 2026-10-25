import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Appearance } from 'react-native';

import { getThemePreference, setThemePreference, THEME_STORAGE_KEY } from '../../theme/themePreference';
import { ThemeSwitch } from '../ThemeSwitch';

beforeEach(async () => {
  jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => undefined);
  setThemePreference('system');
  await AsyncStorage.clear();
});

afterEach(() => jest.restoreAllMocks());

describe('ThemeSwitch', () => {
  it('offers Auto, Light and Dark and marks the current one', async () => {
    await render(<ThemeSwitch />);

    expect(screen.getByRole('tab', { name: 'Auto', selected: true })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Light', selected: false })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Dark', selected: false })).toBeTruthy();
  });

  it('applies the choice at once and remembers it', async () => {
    await render(<ThemeSwitch />);
    const user = userEvent.setup();

    await user.press(screen.getByRole('tab', { name: 'Dark' }));

    expect(getThemePreference()).toBe('dark');
    expect(screen.getByRole('tab', { name: 'Dark', selected: true })).toBeTruthy();
    await waitFor(async () => expect(await AsyncStorage.getItem(THEME_STORAGE_KEY)).toBe('dark'));
  });
});
