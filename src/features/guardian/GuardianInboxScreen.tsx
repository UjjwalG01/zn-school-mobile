// Guardian notification inbox (G6). The shared inbox query and the shared mark-read mutation; the guardian's own destinations
// (guardianDestination). Informational only: a row never carries a document or a payment action.
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import type { AppNotification } from '../../api/types/notifications';
import { Card } from '../../components/Card';
import { ListScreen } from '../../components/ListScreen';
import { QueryState } from '../../components/QueryState';
import { StatusBadge } from '../../components/StatusBadge';
import { Text } from '../../components/Text';
import { typeLabelKey } from '../notifications/notificationsModel';
import { useMarkNotificationRead, useNotifications } from '../notifications/queries';
import { t } from '../../i18n';
import { formatTimestamp } from '../../lib/date';
import { useTenantSettings } from '../queries';
import { useGuardianChild } from './GuardianChildContext';
import { guardianDestination } from './inboxModel';
import { GUARDIAN_NOTICES_HREF, guardianCalendarHref } from './routes';
import { useTheme } from '../../theme/useTheme';

function InboxRow({ row, onOpen }: { row: AppNotification; onOpen: (row: AppNotification) => void }) {
  const calendar = useTenantSettings().data?.calendarPreference ?? 'gregorian';
  const { spacing } = useTheme();
  const unread = row.readAt === null;
  return (
    <Card onPress={() => onOpen(row)} accessibilityLabel={row.title}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
        <Text variant="caption" tone="muted">
          {t(typeLabelKey(row.type))}
        </Text>
        {unread ? <StatusBadge label={t('notifications.unread')} tone="warning" /> : null}
      </View>
      <Text variant={unread ? 'title' : 'body'}>{row.title}</Text>
      <Text tone="muted">{formatTimestamp(Date.parse(row.createdAt), calendar)}</Text>
    </Card>
  );
}

export default function GuardianInboxScreen() {
  const router = useRouter();
  const { students, select } = useGuardianChild();
  const query = useNotifications();
  const markRead = useMarkNotificationRead();
  const rows = query.data?.rows ?? [];
  const linked = students.map((student) => student.studentId);

  const open = (row: AppNotification) => {
    if (row.readAt === null) markRead.mutate(row.id);
    const destination = guardianDestination(row, linked);
    if (!destination) return;
    if (destination.kind === 'attendance') {
      select(destination.studentId);
      router.navigate('/guardian/attendance');
    } else if (destination.kind === 'calendar') {
      router.navigate(guardianCalendarHref(destination.day));
    } else {
      router.navigate(GUARDIAN_NOTICES_HREF);
    }
  };

  return (
    <QueryState query={query} isEmpty={rows.length === 0} emptyText={t('notifications.empty')}>
      <ListScreen
        sections={[{ data: rows }]}
        keyExtractor={(row) => row.id}
        renderItem={({ item }) => <InboxRow row={item} onOpen={open} />}
      />
    </QueryState>
  );
}
