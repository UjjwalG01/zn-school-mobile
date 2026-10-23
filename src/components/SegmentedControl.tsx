import { Pressable, StyleSheet, View } from 'react-native';

import { MIN_TOUCH_TARGET } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Text } from './Text';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Screen-reader name of the group ("Attendance sections"). */
  accessibilityLabel: string;
}

/**
 * Two or three subtabs inside one screen (Attendance: Student Attendance / My Attendance). Not a
 * navigation library: the caller keeps `value` and renders the matching content.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.row,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: radius.lg,
          padding: spacing.xs,
          gap: spacing.xs,
        },
      ]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            style={[
              styles.segment,
              {
                minHeight: MIN_TOUCH_TARGET,
                borderRadius: radius.md,
                paddingHorizontal: spacing.sm,
                backgroundColor: selected ? colors.accent : 'transparent',
              },
            ]}
          >
            <Text
              style={{
                color: selected ? colors.onAccent : colors.text,
                fontWeight: selected ? '600' : '400',
                textAlign: 'center',
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
