import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/useTheme';
import { Text } from './Text';

export interface BannerProps {
  /** `info` is a neutral note (saved data, "any class"); `warning` needs the user's attention. */
  tone: 'info' | 'warning';
  children: string;
}

export function Banner({ tone, children }: BannerProps) {
  const { colors, spacing, radius } = useTheme();
  const warning = tone === 'warning';
  return (
    <View
      accessible
      accessibilityRole={warning ? 'alert' : undefined}
      style={[
        styles.base,
        {
          backgroundColor: warning ? colors.warning : colors.card,
          borderColor: warning ? colors.warning : colors.border,
          borderRadius: radius.lg,
          // `padding` is not in this React Native version's style types: the two axes are written out.
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
        },
      ]}
    >
      <Text
        variant="body"
        tone={warning ? 'default' : 'muted'}
        style={warning ? { color: colors.warningForeground } : undefined}
      >
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: StyleSheet.hairlineWidth },
});
