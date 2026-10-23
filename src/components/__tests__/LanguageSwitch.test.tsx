import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { getLocale, LOCALE_STORAGE_KEY, setLocale } from '../../i18n';
import { LanguageSwitch } from '../LanguageSwitch';

let mockUnsaved = false;
jest.mock('../../features/unsavedWork', () => ({ hasUnsavedWork: () => mockUnsaved }));

beforeEach(async () => {
  mockUnsaved = false;
  setLocale('en');
  await AsyncStorage.clear();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('LanguageSwitch', () => {
  it('offers both languages by their own names and marks the current one', async () => {
    await render(<LanguageSwitch />);

    expect(screen.getByRole('tab', { name: 'English', selected: true })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'नेपाली', selected: false })).toBeTruthy();
  });

  it('applies the language at once and remembers it on the device when nothing is unsaved', async () => {
    await render(<LanguageSwitch />);
    const user = userEvent.setup();

    await user.press(screen.getByRole('tab', { name: 'नेपाली' }));

    await waitFor(() => expect(getLocale()).toBe('ne'));
    expect(await AsyncStorage.getItem(LOCALE_STORAGE_KEY)).toBe('ne');
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('does nothing when the current language is pressed', async () => {
    await render(<LanguageSwitch />);
    const user = userEvent.setup();

    await user.press(screen.getByRole('tab', { name: 'English' }));

    expect(await AsyncStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('asks first when a screen holds unsaved work, and changes nothing until the person agrees', async () => {
    mockUnsaved = true;
    await render(<LanguageSwitch />);
    const user = userEvent.setup();

    await user.press(screen.getByRole('tab', { name: 'नेपाली' }));

    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(getLocale()).toBe('en');
    expect(await AsyncStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull();

    const buttons = jest.mocked(Alert.alert).mock.calls[0]![2]!;
    expect(buttons.map((button) => button.text)).toEqual(['Cancel', 'Change']);
    await act(async () => buttons[0]!.onPress?.()); // cancel
    expect(getLocale()).toBe('en');
    await act(async () => buttons[1]!.onPress?.()); // change
    await waitFor(() => expect(getLocale()).toBe('ne'));
    expect(await AsyncStorage.getItem(LOCALE_STORAGE_KEY)).toBe('ne');
  });
});
