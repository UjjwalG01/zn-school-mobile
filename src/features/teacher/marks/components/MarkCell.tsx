import { StyleSheet, TextInput, View } from 'react-native';

import { Text } from '../../../../components/Text';
import { DISABLED_OPACITY, MIN_TOUCH_TARGET, withAlpha } from '../../../../theme/tokens';
import { useTheme } from '../../../../theme/useTheme';

/** Width of the roll number column, and the least room the roll and the name share before the mark cells wrap under them. */
export const ROLL_WIDTH = 32;
export const ID_MIN_WIDTH = 132;

/**
 * Width of a mark cell. Up to two columns have room to be wide; three still fit beside the name on a 360pt phone. More wrap
 * under the name (the row never scrolls sideways), so the cell never shrinks below a number that is easy to type into.
 */
export const cellWidthFor = (columnCount: number): number => (columnCount <= 2 ? 84 : 60);

export interface MarkCellProps {
  width: number;
  text: string;
  /** false = this subject has no such mark (a Practical column for a theory-only subject): shown disabled, never sent. */
  applicable: boolean;
  /** false = read-only (submitted, or a save in flight). */
  editable: boolean;
  invalid: boolean;
  accessibilityLabel: string;
  onChangeText: (text: string) => void;
}

/**
 * One mark box in a table row: no label or message of its own (the column header names it, the row says what is wrong), so
 * a student stays on one line. A bare `TextInput` rather than `TextField`, which stacks a label above and a message below.
 */
export function MarkCell({ width, text, applicable, editable, invalid, accessibilityLabel, onChangeText }: MarkCellProps) {
  const { colors, radius, typography } = useTheme();
  const box = { width, minHeight: MIN_TOUCH_TARGET, borderRadius: radius.lg };
  if (!applicable) {
    return (
      <View
        accessible
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: true }}
        style={[styles.box, box, { backgroundColor: withAlpha(colors.textMuted, 0.12) }]}
      >
        <Text tone="muted">–</Text>
      </View>
    );
  }
  return (
    <TextInput
      value={text}
      onChangeText={onChangeText}
      editable={editable}
      keyboardType="decimal-pad"
      selectTextOnFocus
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.box,
        box,
        typography.bodyLarge,
        {
          color: colors.text,
          borderColor: invalid ? colors.destructive : colors.border,
          backgroundColor: editable ? colors.card : withAlpha(colors.textMuted, 0.08),
          opacity: editable ? 1 : DISABLED_OPACITY,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', textAlign: 'center', borderWidth: StyleSheet.hairlineWidth * 2 },
});
