import { Pressable, StyleSheet, View } from 'react-native';

import type { AttendanceStatus, AttendanceStatusSetting } from '../../../../api/types/attendance';
import { Text } from '../../../../components/Text';
import { DISABLED_OPACITY, MIN_TOUCH_TARGET } from '../../../../theme/tokens';
import { useTheme } from '../../../../theme/useTheme';

export interface StatusPickerProps {
  /** The statuses the school has switched on, in its order (`statusOptions`). */
  options: readonly AttendanceStatusSetting[];
  selected: AttendanceStatus | null;
  disabled?: boolean;
  /** Names the group for screen readers, e.g. "Status for Sita Sharma". */
  accessibilityLabel: string;
  onSelect: (status: AttendanceStatus) => void;
}

/**
 * One tap target per status, showing the school's short code; the school's full label is the screen-
 * reader name. The selected one is filled and bold, and the row also prints its label as text, so
 * colour is never the only signal. Wraps onto a second line at large font sizes.
 */
export function StatusPicker({ options, selected, disabled, accessibilityLabel, onSelect }: StatusPickerProps) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.group, { gap: spacing.sm }]}
    >
      {options.map((option) => {
        const isSelected = option.status === selected;
        return (
          <Pressable
            key={option.status}
            onPress={() => onSelect(option.status)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: isSelected, disabled: !!disabled }}
            style={[
              styles.option,
              {
                minWidth: MIN_TOUCH_TARGET,
                minHeight: MIN_TOUCH_TARGET,
                paddingHorizontal: spacing.md,
                borderRadius: radius.lg,
                borderColor: isSelected ? colors.accent : colors.border,
                backgroundColor: isSelected ? colors.accent : colors.card,
                opacity: disabled ? DISABLED_OPACITY : 1,
              },
            ]}
          >
            <Text
              variant="bodyLarge"
              style={[styles.code, { color: isSelected ? colors.onAccent : colors.text }, isSelected && styles.codeSelected]}
            >
              {option.shortCode}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', flexWrap: 'wrap' },
  option: { alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth * 2 },
  code: { fontWeight: '500' },
  codeSelected: { fontWeight: '700' },
});
