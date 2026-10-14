import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../theme/useTheme';

export interface ScreenProps {
  children: ReactNode;
}

/**
 * Safe area + keyboard avoidance + scroll, so content stays reachable at large font sizes.
 * Header, pull-to-refresh and the offline banner (UI_SYSTEM §2) are added when a screen needs them.
 */
export function Screen({ children }: ScreenProps) {
  const { colors, spacing } = useTheme();
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { padding: spacing.lg, gap: spacing.lg }]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1 },
});
