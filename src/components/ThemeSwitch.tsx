import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';

import { t } from '../i18n';
import { chooseTheme, THEME_PREFERENCES, type ThemePreference, useThemePreference } from '../theme/themePreference';
import { iconSize } from '../theme/tokens';
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
 * The caller provides the card.
 */
export function ThemeSwitch() {
  const { colors, spacing } = useTheme();
  const preference = useThemePreference();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Ionicons name="moon-outline" size={iconSize.lg} color={colors.accent} accessibilityElementsHidden importantForAccessibility="no" />
        <Text variant="title">{t('theme.title')}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <SegmentedControl
          options={THEME_PREFERENCES.map((value) => ({ value, label: t(LABEL[value]) }))}
          value={preference}
          onChange={(next) => void chooseTheme(next)}
          accessibilityLabel={t('theme.title')}
        />
      </View>
    </View>
  );
}
