import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/useTheme';
import { Text } from './Text';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral';

export interface StatusBadgeProps {
  /** Always shown: the colour alone is never the signal. */
  label: string;
  tone: BadgeTone;
}

/** Pill with a tone-coloured dot and border; the text keeps the default colour for contrast. */
export function StatusBadge({ label, tone }: StatusBadgeProps) {
  const { colors, spacing, radius } = useTheme();
  const toneColor = {
    success: colors.success,
    warning: colors.warning,
    danger: colors.destructive,
    neutral: colors.textMuted,
  }[tone];
  return (
    <View
      style={[
        styles.pill,
        {
          borderColor: toneColor,
          borderRadius: radius.pill,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          gap: spacing.xs,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: toneColor }]} />
      <Text variant="caption">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderWidth: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
