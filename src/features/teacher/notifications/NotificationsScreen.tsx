// The notification inbox (teacher.notifications; the header bell opens it). It lists what the backend put in this person's
// own inbox, newest first, and marks a row read when it is tapped. It owns no event, notice or leave record: a row opens
// the screen that shows the thing when this app has one (the Academic Calendar for an event or a notice), and is only
// marked read otherwise. Who is told what is decided by the backend (docs/api/API_CONTRACT.md §2).
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import type { AppNotification } from '../../../api/types/notifications';
import { Card } from '../../../components/Card';
import { ListScreen } from '../../../components/ListScreen';
import { OfflineBanner, savedDataTimestamp } from '../../../components/OfflineBanner';
import { QueryState, queryView } from '../../../components/QueryState';
import { Screen } from '../../../components/Screen';
import { Text } from '../../../components/Text';
import { t } from '../../../i18n';
import { type CalendarPreference, formatTimestamp } from '../../../lib/date';
import { useTheme } from '../../../theme/useTheme';
import { useRefreshSchoolsOnFeatureDenied } from '../../featureDenied';
import { destinationFor, typeLabelKey } from '../../notifications/notificationsModel';
import { NOTIFICATION_PAGE_SIZE, useMarkNotificationRead, useNotifications } from '../../notifications/queries';
import { useTenantSettings } from '../../queries';
import { menuHref } from '../../routes';
import { useManualRefresh } from '../../useManualRefresh';
import { useVisibleFeatures } from '../../useVisibleFeatures';
import { teacherCalendarFeature } from '../calendar/manifest';

const DOT = 8;

function Row({
  notification,
  calendar,
  opensSomething,
  onOpen,
}: {
  notification: AppNotification;
  calendar: CalendarPreference;
  /** A tap goes to another screen (the chevron says so); otherwise it only marks the row read. */
  opensSomething: boolean;
  onOpen: ((notification: AppNotification) => void) | undefined;
}) {
  const { colors, spacing } = useTheme();
  const unread = notification.readAt === null;
  const when = formatTimestamp(Date.parse(notification.createdAt), calendar);
  return (
    <Card
      onPress={onOpen ? () => onOpen(notification) : undefined}
      chevron={opensSomething}
      accessibilityLabel={`${unread ? `${t('notifications.unread')}. ` : ''}${notification.title}. ${t(typeLabelKey(notification.type))}. ${when}`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {unread ? (
          <View style={{ width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: colors.accent }} accessibilityElementsHidden importantForAccessibility="no" />
        ) : null}
        <Text variant="bodyLarge" style={{ flex: 1, fontWeight: unread ? '700' : '400' }}>
          {notification.title}
        </Text>
      </View>
      <Text variant="caption" tone="muted">
        {`${t(typeLabelKey(notification.type))} · ${when}`}
      </Text>
    </Card>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { spacing } = useTheme();
  const query = useNotifications();
  const markRead = useMarkNotificationRead();
  const calendar: CalendarPreference = useTenantSettings().data?.calendarPreference ?? 'gregorian';
  const calendarVisible = useVisibleFeatures('teacher').some((feature) => feature.id === teacherCalendarFeature.id);
  useRefreshSchoolsOnFeatureDenied(query.error);
  const { refreshing, onRefresh } = useManualRefresh(() => query.refetch());

  const rows = query.data?.rows;
  const sections = useMemo(() => (rows && rows.length > 0 ? [{ data: rows }] : []), [rows]);
  const savedFrom = savedDataTimestamp([query]);

  // Loading, error and "no access" reuse the shared QueryState on a plain screen; an empty inbox is its own line.
  if (queryView(query, { isEmpty: rows?.length === 0 }) !== 'content') {
    return (
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <QueryState query={query} isEmpty={rows?.length === 0} emptyText={t('notifications.empty')}>
          {null}
        </QueryState>
      </Screen>
    );
  }

  const open = (notification: AppNotification) => {
    if (notification.readAt === null) markRead.mutate(notification.id);
    if (destinationFor(notification, { calendarVisible }) === 'calendar') router.push(menuHref(teacherCalendarFeature));
  };

  return (
    <ListScreen
      sections={sections}
      keyExtractor={(row) => row.id}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListHeaderComponent={savedFrom === null ? null : <OfflineBanner asOf={savedFrom} />}
      renderItem={({ item }) => {
        const opensSomething = destinationFor(item, { calendarVisible }) !== null;
        return (
          <Row
            notification={item}
            calendar={calendar}
            opensSomething={opensSomething}
            // A row with nothing to do (already read, nowhere to go) is not a button.
            onOpen={item.readAt === null || opensSomething ? open : undefined}
          />
        );
      }}
      ListFooterComponent={
        query.data && query.data.total > NOTIFICATION_PAGE_SIZE ? (
          <Text variant="caption" tone="muted" style={{ paddingTop: spacing.sm }}>
            {t('notifications.newestOnly', { shown: NOTIFICATION_PAGE_SIZE, total: query.data.total })}
          </Text>
        ) : null
      }
    />
  );
}
