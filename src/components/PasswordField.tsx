import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { t } from '../i18n';
import { MIN_TOUCH_TARGET } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Text } from './Text';
import { TextField, type TextFieldProps } from './TextField';

export type PasswordFieldProps = Omit<
  TextFieldProps,
  'secureTextEntry' | 'endAdornment' | 'autoCapitalize' | 'autoCorrect'
>;

/** Password input with a show/hide toggle. Never logs or persists the value. */
export function PasswordField(props: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const { spacing } = useTheme();
  const toggleLabel = visible ? t('common.hide') : t('common.show');
  return (
    <TextField
      autoComplete="current-password"
      textContentType="password"
      {...props}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      endAdornment={
        <Pressable
          onPress={() => setVisible((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={`${toggleLabel} ${props.label}`}
          hitSlop={spacing.xs}
          style={[styles.toggle, { paddingHorizontal: spacing.md }]}
        >
          <Text variant="body" tone="brand" style={styles.toggleText}>
            {toggleLabel}
          </Text>
        </Pressable>
      }
    />
  );
}

const styles = StyleSheet.create({
  toggle: { minWidth: MIN_TOUCH_TARGET, minHeight: MIN_TOUCH_TARGET, justifyContent: 'center' },
  toggleText: { fontWeight: '600' },
});
