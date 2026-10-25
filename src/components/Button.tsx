import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { DISABLED_OPACITY, MIN_TOUCH_TARGET } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Text } from './Text';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  /** `primary` is a filled button; `link` is a text-only action. */
  variant?: 'primary' | 'link';
  /** In-flight: blocks further presses and shows a spinner (CLAUDE rule: no double submit). */
  loading?: boolean;
  disabled?: boolean;
  /** A `link` on the brand-coloured header (the shell switcher): light text instead of the accent. */
  inverse?: boolean;
}

export function Button({ title, onPress, variant = 'primary', loading, disabled, inverse }: ButtonProps) {
  const { colors, spacing, radius } = useTheme();
  const inactive = disabled || loading;
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: MIN_TOUCH_TARGET,
          paddingHorizontal: spacing.lg,
          gap: spacing.sm,
          borderRadius: radius.pill,
          backgroundColor: primary ? colors.accent : 'transparent',
          opacity: inactive ? DISABLED_OPACITY : pressed ? 0.85 : 1,
        },
      ]}
    >
      {loading ? <ActivityIndicator color={primary ? colors.onAccent : colors.accent} /> : null}
      <Text
        variant="bodyLarge"
        tone={primary ? 'default' : inverse ? 'inverse' : 'brand'}
        style={[styles.title, primary && { color: colors.onAccent }]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  title: { fontWeight: '600', textAlign: 'center' },
});
