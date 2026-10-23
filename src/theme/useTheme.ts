import { useColorScheme } from 'react-native';

import { type ColorScheme, palettes, radius, spacing, typography } from './tokens';

/** Components read colors/spacing from here — never literal values. Follows the system scheme. */
export function useTheme() {
  const scheme: ColorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { scheme, colors: palettes[scheme], spacing, radius, typography };
}

/** `screenOptions` for a navigation header, so it follows the system scheme like the screens do (it is white in dark mode otherwise). */
export function useHeaderOptions() {
  const { colors } = useTheme();
  return { headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text };
}
