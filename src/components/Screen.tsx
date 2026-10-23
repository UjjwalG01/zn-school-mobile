import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../theme/useTheme';

export interface ScreenProps {
  children: ReactNode;
  /** Pull-to-refresh is on only when `onRefresh` is given. */
  refreshing?: boolean;
  onRefresh?: () => void;
}

/**
 * Safe area + keyboard avoidance + scroll, so content stays reachable at large font sizes.
 * Pull-to-refresh is opt-in; header and the offline banner (UI_SYSTEM §2) are added when a screen
 * needs them.
 */
export function Screen({ children, refreshing = false, onRefresh }: ScreenProps) {
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
          refreshControl={
            onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined
          }
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
