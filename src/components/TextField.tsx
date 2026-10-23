import type { ReactNode, Ref } from 'react';
import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { MIN_TOUCH_TARGET } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Text } from './Text';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Inline validation message; also announced to screen readers. */
  error?: string | null;
  /** Rendered inside the border at the end (e.g. the password show/hide toggle). */
  endAdornment?: ReactNode;
  ref?: Ref<TextInput>;
}

/** Label + input + error — the web `Input` contract (UI_SYSTEM §2). */
export function TextField({ label, error, endAdornment, ref, ...input }: TextFieldProps) {
  const { colors, spacing, radius, typography } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="body" style={styles.label}>
        {label}
      </Text>
      <View
        style={[
          styles.box,
          {
            minHeight: MIN_TOUCH_TARGET + spacing.sm,
            backgroundColor: colors.card,
            borderColor: error ? colors.destructive : colors.border,
            borderRadius: radius.lg,
            paddingStart: spacing.md,
          },
        ]}
      >
        <TextInput
          accessibilityLabel={label}
          {...input}
          ref={ref}
          placeholderTextColor={colors.textMuted}
          style={[
            styles.input,
            typography.bodyLarge,
            { color: colors.text, paddingVertical: spacing.sm },
          ]}
        />
        {endAdornment}
      </View>
      {error ? (
        <Text variant="caption" tone="error" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontWeight: '600' },
  box: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth * 2 },
  input: { flex: 1 },
});
