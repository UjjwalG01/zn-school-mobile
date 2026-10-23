import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { MIN_TOUCH_TARGET, withAlpha } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

/** A tinted card is the tint colour at this opacity over the screen, with no border. */
const TINT_OPACITY = 0.14;

export interface CardProps {
  children: ReactNode;
  /** A palette colour (e.g. `colors.success`) that tints the card, as the Calendar's event rows are. Text keeps the default colour. */
  tint?: string;
  /** Makes the whole card a button (≥ 44pt) with a trailing chevron. Leave undefined for a static summary card. */
  onPress?: () => void;
  /** Screen-reader label; required in practice when `onPress` is set. */
  accessibilityLabel?: string;
  /** A coloured border for a card that needs attention (a conflict, a refusal). The card must also say why in text. */
  emphasis?: 'warning' | 'danger';
}

export function Card({ children, tint, onPress, accessibilityLabel, emphasis }: CardProps) {
  const { colors, spacing, radius } = useTheme();
  const surface = {
    backgroundColor: tint ? withAlpha(tint, TINT_OPACITY) : colors.card,
    borderColor: emphasis === 'danger' ? colors.destructive : emphasis === 'warning' ? colors.warning : colors.border,
    borderWidth: emphasis ? 2 : tint ? 0 : StyleSheet.hairlineWidth,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.xs,
  };

  if (!onPress) {
    return (
      <View style={[styles.base, surface]} accessibilityLabel={accessibilityLabel}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.base,
        surface,
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          minHeight: MIN_TOUCH_TARGET,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={{ flex: 1, gap: spacing.xs }}>{children}</View>
      <Ionicons
        name="chevron-forward"
        size={20}
        color={colors.textMuted}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: StyleSheet.hairlineWidth },
});
