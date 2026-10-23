import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { MIN_TOUCH_TARGET } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Text } from './Text';

export interface StepperProps {
  /** The current position as text (a date, a month). */
  label: string;
  /** A muted second line, e.g. the other calendar's date. */
  sublabel?: string | null;
  /** Screen-reader names of the two arrows. */
  previousLabel: string;
  nextLabel: string;
  canGoBack: boolean;
  canGoForward: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

/** Previous / next arrows around a label. `DateStepper` (days) and My Attendance (months) are built on it. */
export function Stepper({
  label,
  sublabel,
  previousLabel,
  nextLabel,
  canGoBack,
  canGoForward,
  onPrevious,
  onNext,
}: StepperProps) {
  const { colors, spacing, radius } = useTheme();

  const arrow = (name: string, icon: 'chevron-back' | 'chevron-forward', enabled: boolean, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityState={{ disabled: !enabled }}
      style={[
        styles.arrow,
        {
          width: MIN_TOUCH_TARGET,
          height: MIN_TOUCH_TARGET,
          borderRadius: radius.lg,
          borderColor: colors.border,
          backgroundColor: colors.card,
          opacity: enabled ? 1 : 0.4,
        },
      ]}
    >
      <Ionicons name={icon} size={24} color={colors.text} />
    </Pressable>
  );

  return (
    <View style={[styles.row, { gap: spacing.md }]}>
      {arrow(previousLabel, 'chevron-back', canGoBack, onPrevious)}
      <View style={styles.label}>
        <Text variant="bodyLarge" style={styles.labelText}>
          {label}
        </Text>
        {sublabel ? (
          <Text variant="caption" tone="muted">
            {sublabel}
          </Text>
        ) : null}
      </View>
      {arrow(nextLabel, 'chevron-forward', canGoForward, onNext)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { flex: 1, alignItems: 'center' },
  labelText: { fontWeight: '600' },
  arrow: { alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
});
