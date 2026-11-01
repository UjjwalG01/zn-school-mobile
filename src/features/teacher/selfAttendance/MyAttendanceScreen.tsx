// My Attendance (teacher.selfAttendance): today's "Mark present" and the caller's own month. The
// backend decides who the caller is, what today is and whether it is a school day; this screen shows
// that and sends one body-less POST (docs/project/TEACHER_APP_PLAN.md §5).
import { useState } from 'react';
import { View } from 'react-native';

import { errorActionOf } from '../../../api/errors';
import type { AttendanceStatus, MyAttendance } from '../../../api/types/attendance';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { DataTable } from '../../../components/DataTable';
import { OfflineBanner, savedDataTimestamp } from '../../../components/OfflineBanner';
import { QueryState } from '../../../components/QueryState';
import { Screen } from '../../../components/Screen';
import { Stepper } from '../../../components/Stepper';
import { StatusBadge } from '../../../components/StatusBadge';
import { Text } from '../../../components/Text';
import { t } from '../../../i18n';
import { formatDate, formatMonth, shiftMonth } from '../../../lib/date';
import { showToast } from '../../../lib/toast';
import { useTheme } from '../../../theme/useTheme';
import { useRefreshSchoolsOnFeatureDenied } from '../../featureDenied';
import { useTenantSettings } from '../../queries';
import { useManualRefresh } from '../../useManualRefresh';
import { STATUS_TONE } from '../../../lib/attendanceStatus';
import { labelFor } from '../attendance/attendanceModel';
import { dayOffText } from '../attendance/dayOffText';
import { useAttendanceSettings } from '../attendance/queries';
import { isNotLinked, markErrorKey, recordFor, statusSummary } from './model';
import { useMarkPresent, useMyAttendance } from './queries';

export default function MyAttendanceScreen() {
  const { spacing } = useTheme();
  const [month, setMonth] = useState<string | null>(null);
  // Today's card always reads the current month; with `month === null` both reads share one cache entry.
  const current = useMyAttendance(null);
  const shown = useMyAttendance(month);
  const settings = useAttendanceSettings().data;
  const calendar = useTenantSettings().data?.calendarPreference;
  const mark = useMarkPresent();
  useRefreshSchoolsOnFeatureDenied(current.error, shown.error);
  const { refreshing, onRefresh } = useManualRefresh(() =>
    Promise.all([current.refetch(), month === null ? null : shown.refetch()]),
  );

  const statusLabel = (status: AttendanceStatus) => (settings ? labelFor(settings, status) : status);
  const dateText = (iso: string) => (calendar ? formatDate(iso, calendar) : iso);

  function onMark() {
    mark.mutate(undefined, {
      onSuccess: ({ outcome }) =>
        showToast(t(outcome === 'created' ? 'selfAttendance.marked' : 'selfAttendance.unchanged'), 'success'),
      onError: (error) => {
        showToast(t(markErrorKey(error)), 'error');
        // 409: an administrator recorded today differently; show what is stored.
        if (errorActionOf(error) === 'conflict') void current.refetch();
      },
    });
  }

  if (!current.data && isNotLinked(current.error)) {
    return (
      <Screen>
        <Banner tone="info">{t('selfAttendance.notLinked')}</Banner>
      </Screen>
    );
  }

  const currentMonth = current.data?.month ?? null;
  const viewMonth = month ?? currentMonth;
  const goTo = (next: string) => setMonth(next === currentMonth ? null : next);

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <OfflineBanner asOf={savedDataTimestamp([current])} />
      <QueryState query={current}>
        {current.data ? (
          <TodayCard
            data={current.data}
            dateText={dateText}
            statusLabel={statusLabel}
            marking={mark.isPending}
            onMark={onMark}
          />
        ) : null}
      </QueryState>

      {viewMonth ? (
        <View style={{ gap: spacing.md }}>
          <Text variant="title" accessibilityRole="header">
            {t('selfAttendance.month')}
          </Text>
          <Stepper
            label={formatMonth(viewMonth)}
            previousLabel={t('selfAttendance.previousMonth')}
            nextLabel={t('selfAttendance.nextMonth')}
            canGoBack
            canGoForward={currentMonth !== null && viewMonth < currentMonth}
            onPrevious={() => goTo(shiftMonth(viewMonth, -1))}
            onNext={() => goTo(shiftMonth(viewMonth, 1))}
          />
          <QueryState query={shown} isEmpty={shown.data?.records.length === 0} emptyText={t('selfAttendance.noRecords')}>
            {shown.data ? (
              <View style={{ gap: spacing.sm }}>
                <Text tone="muted">{statusSummary(shown.data.records, statusLabel)}</Text>
                <Card chevron={false}>
                  <DataTable
                    columns={[
                      { key: 'date', title: t('table.date'), render: (record) => <Text>{dateText(record.attendanceDate)}</Text> },
                      {
                        key: 'status',
                        title: t('table.status'),
                        render: (record) => <StatusBadge label={statusLabel(record.status)} tone={STATUS_TONE[record.status]} />,
                      },
                    ]}
                    rows={shown.data.records}
                    keyExtractor={(record) => record.id}
                    rowLabel={(record) => `${dateText(record.attendanceDate)}, ${statusLabel(record.status)}`}
                  />
                </Card>
              </View>
            ) : null}
          </QueryState>
        </View>
      ) : null}
    </Screen>
  );
}

function TodayCard({
  data,
  dateText,
  statusLabel,
  marking,
  onMark,
}: {
  data: MyAttendance;
  dateText: (iso: string) => string;
  statusLabel: (status: AttendanceStatus) => string;
  marking: boolean;
  onMark: () => void;
}) {
  const record = recordFor(data.records, data.today);
  return (
    <Card>
      <Text variant="caption" tone="muted">
        {t('selfAttendance.today')}
      </Text>
      <Text variant="title">{dateText(data.today)}</Text>
      {record ? (
        <StatusBadge label={statusLabel(record.status)} tone={STATUS_TONE[record.status]} />
      ) : data.todayDay.schoolDay ? (
        <>
          <Text tone="muted">{t('attendance.notMarked')}</Text>
          <Button title={t('selfAttendance.markPresent')} onPress={onMark} loading={marking} />
        </>
      ) : (
        <Banner tone="warning">{dayOffText(data.todayDay)}</Banner>
      )}
    </Card>
  );
}
