// Guardian notices (G6): the notices the server says this guardian may read. A notice opens in place: the backend has no notice-by-id
// route, so the row already carries its body. The server applies the audience and the child's class scope; the app filters nothing.
import { useState } from 'react';
import { View } from 'react-native';

import type { Notice } from '../../api/types/calendar';
import { Card } from '../../components/Card';
import { ListScreen } from '../../components/ListScreen';
import { QueryState } from '../../components/QueryState';
import { Text } from '../../components/Text';
import { t } from '../../i18n';
import { formatTimestamp } from '../../lib/date';
import { useTheme } from '../../theme/useTheme';
import { useTenantSettings } from '../queries';
import { useGuardianNotices } from './queries';

function NoticeRow({ notice, open, onToggle }: { notice: Notice; open: boolean; onToggle: () => void }) {
  const calendar = useTenantSettings().data?.calendarPreference ?? 'gregorian';
  const { spacing } = useTheme();
  return (
    <Card onPress={onToggle} chevron={false} accessibilityLabel={notice.title}>
      <Text variant="title">{notice.title}</Text>
      <Text tone="muted">{formatTimestamp(Date.parse(notice.publishedAt), calendar)}</Text>
      {open ? <View style={{ marginTop: spacing.sm }}><Text>{notice.body}</Text></View> : null}
    </Card>
  );
}

export default function GuardianNoticesScreen() {
  const query = useGuardianNotices();
  const [openId, setOpenId] = useState<string | null>(null);
  const rows = query.data?.rows ?? [];
  return (
    <QueryState query={query} isEmpty={rows.length === 0} emptyText={t('guardian.notices.empty')}>
      <ListScreen
        sections={[{ data: rows }]}
        keyExtractor={(notice) => notice.id}
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
        renderItem={({ item }) => (
          <NoticeRow
            notice={item}
            open={openId === item.id}
            onToggle={() => setOpenId((current) => (current === item.id ? null : item.id))}
          />
        )}
      />
    </QueryState>
  );
}
