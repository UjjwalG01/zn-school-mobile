// Guardian Attendance (G3): one child's month of attendance, as the school's attendance report computed it. The counts, the
// percentage and the day statuses are the server's; the labels are the school's own (`statusLabels`), with the app's words only as a fallback.
import { useState } from 'react';
import { View } from 'react-native';

import type { GuardianAttendanceEnrollment } from '../../api/portal';
import type { AttendanceStatus } from '../../api/types/attendance';
import { Card } from '../../components/Card';
import { DataTable } from '../../components/DataTable';
import { QueryState } from '../../components/QueryState';
import { Stepper } from '../../components/Stepper';
import { StatusBadge, type BadgeTone } from '../../components/StatusBadge';
import { Text } from '../../components/Text';
import { formatDate, formatMonth, shiftMonth, todayIso } from '../../lib/date';
import { t, type MessageKey } from '../../i18n';
import { useTheme } from '../../theme/useTheme';
import { STATUS_TONE } from '../../lib/attendanceStatus';
import { ChildFrame, useGuardianChild } from './GuardianChildContext';
import { useGuardianAttendance } from './queries';
import { useTenantSettings } from '../queries';

/** The server's status word → the shared attendance tone (one mapping for every attendance list). */
const toneOf = (status: string): BadgeTone | undefined =>
  status in STATUS_TONE ? STATUS_TONE[status as AttendanceStatus] : undefined;

const STATUS_WORD: Record<string, MessageKey> = {
  present: 'guardian.attendance.status.present',
  absent: 'guardian.attendance.status.absent',
  late: 'guardian.attendance.status.late',
  half_day: 'guardian.attendance.status.halfDay',
  excused: 'guardian.attendance.status.excused',
};

const KIND_WORD: Record<string, MessageKey> = {
  school: 'guardian.attendance.kind.schoolDay',
  weekly_off: 'guardian.attendance.kind.weeklyOff',
  holiday: 'guardian.attendance.kind.holiday',
};

/** The current AD month as `YYYY-MM`; the stepper never goes past it. */
const currentMonth = () => todayIso().slice(0, 7);

function EnrollmentBlock({
  enrollment,
  labels,
  calendar,
}: {
  enrollment: GuardianAttendanceEnrollment;
  labels: Record<string, { label: string; shortCode: string }>;
  calendar: 'gregorian' | 'nepali';
}) {
  const { spacing } = useTheme();
  const days = [...enrollment.days].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <View style={{ gap: spacing.sm }}>
      <Card chevron={false}>
        <Text variant="title">
          {t('guardian.attendance.percentage', { value: enrollment.percentage ?? '—' })}
        </Text>
        <Text tone="muted">{t('guardian.attendance.schoolDays', { count: enrollment.schoolDays })}</Text>
        {Object.entries(enrollment.counts).map(([status, count]) => (
          <Text key={status}>
            {`${labels[status]?.label ?? t(STATUS_WORD[status] ?? 'guardian.attendance.status.unknown')}: ${count}`}
          </Text>
        ))}
        <Text tone="muted">{t('guardian.attendance.notRecorded', { count: enrollment.notRecorded })}</Text>
      </Card>
      {days.length === 0 ? (
        <Text tone="muted">{t('guardian.attendance.empty')}</Text>
      ) : (
        <Card chevron={false}>
          <DataTable
            columns={[
              { key: 'date', title: t('table.date'), flex: 1.2, render: (day) => <Text>{formatDate(day.date, calendar)}</Text> },
              {
                key: 'kind',
                title: t('table.kind'),
                render: (day) => <Text tone="muted">{KIND_WORD[day.kind] ? t(KIND_WORD[day.kind]!) : '–'}</Text>,
              },
              {
                key: 'status',
                title: t('table.status'),
                render: (day) => {
                  const tone = toneOf(day.status);
                  return tone ? (
                    <StatusBadge label={labels[day.status]?.label ?? t(STATUS_WORD[day.status]!)} tone={tone} />
                  ) : (
                    <Text tone="muted">{t('guardian.attendance.status.notRecorded')}</Text>
                  );
                },
              },
            ]}
            rows={days}
            keyExtractor={(day) => day.date}
          />
        </Card>
      )}
    </View>
  );
}

function AttendanceBody({ month }: { month: string }) {
  const { child } = useGuardianChild();
  const query = useGuardianAttendance(child?.studentId ?? null, month);
  const calendar = useTenantSettings().data?.calendarPreference ?? 'gregorian';
  const data = query.data;
  return (
    <QueryState query={query}>
      {data ? (
        <View>
          {data.enrollments.map((enrollment) => (
            <EnrollmentBlock
              key={enrollment.enrollmentId}
              enrollment={enrollment}
              labels={data.statusLabels}
              calendar={calendar}
            />
          ))}
        </View>
      ) : null}
    </QueryState>
  );
}

export default function GuardianAttendanceScreen() {
  const [month, setMonth] = useState(currentMonth);
  const now = currentMonth();
  return (
    <ChildFrame>
      {() => (
        <View style={{ gap: 12 }}>
          <Stepper
            label={formatMonth(month)}
            previousLabel={t('guardian.attendance.previousMonth')}
            nextLabel={t('guardian.attendance.nextMonth')}
            canGoBack
            canGoForward={month < now}
            onPrevious={() => setMonth((m) => shiftMonth(m, -1))}
            onNext={() => setMonth((m) => shiftMonth(m, 1))}
          />
          <AttendanceBody month={month} />
        </View>
      )}
    </ChildFrame>
  );
}
