import { useEffect, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '../i18n';
import { dismissToast, getToast, showToast, subscribeToast, TOAST_DURATION_MS, type ToastMessage } from '../lib/toast';
import { iconSize, MIN_TOUCH_TARGET } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Text } from './Text';
import Ionicons from '@expo/vector-icons/Ionicons';

/** Where the slide starts and ends: above the top edge, so the toast drops in and rises back out of view. */
const HIDDEN_Y = -120;
/** How long the slide-out takes; the toast stays mounted until it has finished. */
const HIDE_MS = 220;

/**
 * Renders the toast from `src/lib/toast.ts`; mount it once, last, in the root layout. It sits at the
 * TOP of the screen so it never covers a bottom action (the attendance Save bar, the tab bar), and
 * its wrapper ignores touches so the screen below stays usable. Tap to dismiss; it also hides itself.
 * It pops down from the top when shown and slides back up when hidden.
 */
export function ToastHost() {
  const toast = useSyncExternalStore(subscribeToast, getToast, getToast);
  const { colors, spacing, radius } = useTheme();
  // Keeps the last toast mounted while it slides out, so the text does not vanish mid-animation.
  const [shown, setShown] = useState<ToastMessage | null>(null);
  const [slide] = useState(() => new Animated.Value(HIDDEN_Y));
  const [fade] = useState(() => new Animated.Value(0));
  // A new toast is kept during render (React's "adjust state when a prop changes" pattern), not in an effect.
  if (toast && toast !== shown) setShown(toast);

  useEffect(() => {
    if (!toast) return;
    // Screen readers do not move focus to a toast, so announce it.
    AccessibilityInfo.announceForAccessibility(toast.message);
    // A springy drop from the top (the pop), faded in together. A new toast during a slide-out cancels it.
    Animated.parallel([
      Animated.spring(slide, { toValue: 0, friction: 7, tension: 90, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(() => dismissToast(toast.id), TOAST_DURATION_MS[toast.tone]);
    return () => clearTimeout(timer);
  }, [toast, slide, fade]);

  useEffect(() => {
    if (toast) return;
    // Slides back up and fades out. Unmounts only when it finishes: a toast shown meanwhile cancels it (`finished` is false).
    Animated.parallel([
      Animated.timing(slide, { toValue: HIDDEN_Y, duration: HIDE_MS, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0, duration: HIDE_MS, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) setShown(null);
    });
  }, [toast, slide, fade]);

  const display = toast ?? shown;
  if (!display) return null;
  // Inverse surface (readable in light and dark); the stripe is only a hint, the message says it all.
  const stripe = { info: colors.accent, success: colors.success, error: colors.destructive }[display.tone];
  return (
    <SafeAreaView edges={['top']} pointerEvents="box-none" style={styles.overlay}>
      <Animated.View
        pointerEvents="box-none"
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          opacity: fade,
          transform: [{ translateY: slide }],
        }}
      >
        <Pressable
          onPress={() => dismissToast(display.id)}
          accessibilityRole={display.tone === 'error' ? 'alert' : 'text'}
          accessibilityLabel={display.message}
          accessibilityHint={t('common.dismiss')}
          style={[
            styles.toast,
            {
              minHeight: MIN_TOUCH_TARGET * 1.25,
              backgroundColor: colors.card,
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              shadowColor: colors.destructive,
              borderStartColor: stripe,
              borderStartWidth: spacing.sm,
              borderRadius: radius.lg,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
            <Text variant="headline" style={{ flex: 1, color: colors.text, fontSize: 13, fontWeight: 600, }}>
              {display.message}
            </Text>
            <Ionicons style={{ color: colors.text }} name='notifications' size={iconSize.sm} />
          </View>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // zIndex + elevation: a navigation header must not be drawn over the toast on Android.
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000, elevation: 8 },
  toast: { justifyContent: 'center', borderStartWidth: 4 },
});
