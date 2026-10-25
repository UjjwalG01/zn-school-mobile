// The bell at the end of the page header (`shellHeaderOptions`), so it is in the same place on every screen of a shell. It
// reads the inbox query the list screen also uses (one request for both) and opens the inbox. A failed or forbidden read
// shows the bell without a badge: the list screen explains the failure.
import Ionicons from '@expo/vector-icons/Ionicons';
import { type Href, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../../components/Text';
import { t } from '../../i18n';
import { iconSize, MIN_TOUCH_TARGET } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { badgeText } from './notificationsModel';
import { useNotifications } from './queries';

const BADGE_SIZE = 16;

export function NotificationBell({ href }: { href: Href }) {
  const router = useRouter();
  const { colors } = useTheme();
  const unread = useNotifications().data?.unread ?? 0;
  const badge = badgeText(unread);
  return (
    <Pressable
      // `navigate` reuses the inbox if it is already open instead of stacking a second one.
      onPress={() => router.navigate(href)}
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? t('notifications.bellUnread', { count: unread }) : t('notifications.title')}
      style={styles.target}
    >
      <Ionicons name="notifications-outline" size={iconSize.lg} color={colors.textInverse} />
      {badge ? (
        <View style={[styles.badge, { backgroundColor: colors.destructive }]}>
          {/* Scaling is capped: the count must stay inside its circle at the largest system font. */}
          <Text variant="caption" maxFontSizeMultiplier={1.2} style={{ color: colors.onAccent, fontWeight: '700' }}>
            {badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 6,
    end: 4,
    minWidth: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
