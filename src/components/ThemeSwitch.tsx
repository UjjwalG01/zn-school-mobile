import { View } from 'react-native';

import { t } from '../i18n';
import { chooseTheme, THEME_PREFERENCES, type ThemePreference, useThemePreference } from '../theme/themePreference';
import { useTheme } from '../theme/useTheme';
import { SegmentedControl } from './SegmentedControl';
import { Text } from './Text';

const LABEL = {
  system: 'theme.system',
  light: 'theme.light',
  dark: 'theme.dark',
} as const satisfies Record<ThemePreference, string>;

/**
 * Light, dark, or follow the device (Profile). One tap each, applied at once: every colour comes from `useTheme`, so
 * nothing needs to reload and no unsaved work is at risk (unlike the language). The choice is remembered on the device.
 */
export function ThemeSwitch() {
  const { spacing } = useTheme();
  const preference = useThemePreference();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="caption" tone="muted">
        {t('theme.title')}
      </Text>
      <SegmentedControl
        options={THEME_PREFERENCES.map((value) => ({ value, label: t(LABEL[value]) }))}
        value={preference}
        onChange={(next) => void chooseTheme(next)}
        accessibilityLabel={t('theme.title')}
      />
    </View>
  );
}
