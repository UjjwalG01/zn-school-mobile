// Guardian calendar (G6): the school's events and holidays for one month, as the guardian calendar route returns them. The route's items
// already exclude internal notes, audience flags and leave. A notification may open it on the month of its day.
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Card } from '../../components/Card';
import { DateBadge } from '../../components/DateBadge';
import { ListScreen } from '../../components/ListScreen';
import { QueryState } from '../../components/QueryState';
import { Stepper } from '../../components/Stepper';
import { Text } from '../../components/Text';
import { t } from '../../i18n';
import { formatDayMonth, formatMonth, shiftMonth, todayIso } from '../../lib/date';
import { useTheme } from '../../theme/useTheme';
import { useTenantSettings } from '../queries';
import { monthRange } from './childModel';
import { byStartDate, monthFor } from './guardianCalendarModel';
import { useGuardianCalendar } from './queries';

export default function GuardianCalendarScreen() {
  const { day } = useLocalSearchParams<{ day?: string }>();
  const { colors, spacing } = useTheme();
  const calendar = useTenantSettings().data?.calendarPreference ?? 'gregorian';
  const [month, setMonth] = useState(() => monthFor(day, todayIso()));
  const { from, to } = monthRange(month);
  const query = useGuardianCalendar(from, to);
  const items = useMemo(() => byStartDate(query.data?.items ?? []), [query.data]);

  return (
    <ListScreen
      sections={[{ data: items }]}
      keyExtractor={(item) => `${item.kind}-${item.id}`}
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
      ListHeaderComponent={
        <View style={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
          <Stepper
            label={formatMonth(month)}
            previousLabel={t('guardian.calendar.previousMonth')}
            nextLabel={t('guardian.calendar.nextMonth')}
            canGoBack
            canGoForward
            onPrevious={() => setMonth((m) => shiftMonth(m, -1))}
            onNext={() => setMonth((m) => shiftMonth(m, 1))}
          />
        </View>
      }
      ListEmptyComponent={
        <QueryState query={query} isEmpty emptyText={t('guardian.calendar.empty')}>
          {null}
        </QueryState>
      }
      renderItem={({ item }) => {
        const { day: dayText, month: monthText } = formatDayMonth(item.startDate, calendar);
        return (
          <Card chevron={false} accessibilityLabel={item.title}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <DateBadge
                day={dayText}
                month={monthText}
                color={item.kind === 'holiday' ? colors.textMuted : colors.accent}
              />
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text variant="title">{item.title}</Text>
                <Text tone="muted">
                  {`${item.kind === 'holiday' ? t('guardian.calendar.holiday') : t('guardian.calendar.event')} · ${item.typeLabel}`}
                </Text>
              </View>
            </View>
          </Card>
        );
      }}
    />
  );
}
