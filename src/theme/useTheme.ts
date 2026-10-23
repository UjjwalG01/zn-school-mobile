import { useColorScheme } from 'react-native';

import { type ColorScheme, palettes, radius, spacing, typography } from './tokens';

/** Components read colors/spacing from here — never literal values. Follows the system scheme. */
export function useTheme() {
  const scheme: ColorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { scheme, colors: palettes[scheme], spacing, radius, typography };
}
