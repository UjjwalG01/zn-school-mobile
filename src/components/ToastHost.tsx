import { useEffect, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '../i18n';
import { dismissToast, getToast, subscribeToast, TOAST_DURATION_MS } from '../lib/toast';
import { MIN_TOUCH_TARGET } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Text } from './Text';

/**
 * Renders the toast from `src/lib/toast.ts`; mount it once, last, in the root layout. It sits at the
 * TOP of the screen so it never covers a bottom action (the attendance Save bar, the tab bar), and
 * its wrapper ignores touches so the screen below stays usable. Tap to dismiss; it also hides itself.
 */
export function ToastHost() {
  const toast = useSyncExternalStore(subscribeToast, getToast, getToast);
  const { colors, spacing, radius } = useTheme();

  useEffect(() => {
    if (!toast) return;
    // Screen readers do not move focus to a toast, so announce it.
    AccessibilityInfo.announceForAccessibility(toast.message);
    const timer = setTimeout(() => dismissToast(toast.id), TOAST_DURATION_MS[toast.tone]);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;
  // Inverse surface (readable in light and dark); the stripe is only a hint, the message says it all.
  const stripe = { info: colors.accent, success: colors.success, error: colors.destructive }[toast.tone];
  return (
    <SafeAreaView edges={['top']} pointerEvents="box-none" style={styles.overlay}>
      <View pointerEvents="box-none" style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        <Pressable
          onPress={() => dismissToast(toast.id)}
          accessibilityRole={toast.tone === 'error' ? 'alert' : 'text'}
          accessibilityLabel={toast.message}
          accessibilityHint={t('common.dismiss')}
          style={[
            styles.toast,
            {
              minHeight: MIN_TOUCH_TARGET,
              backgroundColor: colors.header,
              borderStartColor: stripe,
              borderRadius: radius.lg,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
            },
          ]}
        >
          <Text variant="body" style={{ color: colors.textInverse }}>
            {toast.message}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // zIndex + elevation: a navigation header must not be drawn over the toast on Android.
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000, elevation: 8 },
  toast: { justifyContent: 'center', borderStartWidth: 4 },
});
