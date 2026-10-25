import type { UseQueryResult } from '@tanstack/react-query';
import { View } from 'react-native';

import type { AttendanceStatus, MyAttendance } from '../../../../api/types/attendance';
import type { TeacherSubjectAssignment } from '../../../../api/types/portal';
import { BarChart } from '../../../../components/BarChart';
import { Card } from '../../../../components/Card';
import { QueryState, queryView } from '../../../../components/QueryState';
import { StackedBar } from '../../../../components/StackedBar';
import { Text } from '../../../../components/Text';
import { t } from '../../../../i18n';
import { formatMonth } from '../../../../lib/date';
import { useTheme } from '../../../../theme/useTheme';
import { labelFor } from '../../attendance/attendanceModel';
import { useCachedAttendanceSettings } from '../../attendance/queries';
import { CHART_STATUSES, isNotLinked, monthTotals } from '../../selfAttendance/model';
import { capList, type ExamCard, progressTotals, subjectsPerClass } from '../homeModel';
import { MoreCount } from './Section';

/** How many classes the bar chart lists; the rest are a "+N more" line. */
const CLASS_BARS = 6;

/**
 * Where the marks entry stands: the teacher's subjects, across every open exam, by state. Counts the backend's own
 * submission states, decides nothing. Draws nothing without subjects.
 */
export function MarksProgressChart({ cards, onOpen }: { cards: readonly ExamCard[]; onOpen?: () => void }) {
  const { colors, spacing } = useTheme();
  const { total, counts } = progressTotals(cards);
  if (total === 0) return null;
  return (
    <Card onPress={onOpen}>
      <View style={{ gap: spacing.sm }}>
        <View>
          <Text variant="title" accessibilityRole="header">
            {t('dashboard.marksProgress')}
          </Text>
          <Text tone="muted">{t('dashboard.marksProgressSummary', { done: counts.submitted, total })}</Text>
        </View>
        <StackedBar
          segments={[
            { key: 'submitted', label: t('home.progress.submitted'), value: counts.submitted, color: colors.success },
            { key: 'returned', label: t('home.progress.returned'), value: counts.returned, color: colors.warning },
            { key: 'draft', label: t('home.progress.draft'), value: counts.draft, color: colors.accent },
            { key: 'notStarted', label: t('home.progress.notStarted'), value: counts.notStarted, color: colors.textMuted },
          ]}
        />
      </View>
    </Card>
  );
}

/** Present and absent are always in the legend; the other statuses only once the month has one. */
const ALWAYS_SHOWN: readonly AttendanceStatus[] = ['present', 'absent'];

/**
 * The teacher's own attendance this month, by status: the records `GET /attendance/staff/self` returns for the caller
 * (the server decides who that is; nobody else's records can be here), counted, with no rule of the app's own. It is the
 * query My Attendance already reads, so the Dashboard pays one request for it and none when it is warm. Hidden for an
 * account with no staff record or no access; offline with saved data shows the saved month (Home's banner says so).
 */
export function MyAttendanceChart({ query, onOpen }: { query: UseQueryResult<MyAttendance>; onOpen?: () => void }) {
  const { colors, spacing } = useTheme();
  const settings = useCachedAttendanceSettings();
  const empty = query.data !== undefined && query.data.records.length === 0;
  if (!query.data && isNotLinked(query.error)) return null;
  if (queryView(query, { isEmpty: empty, hideOnForbidden: true }) === 'hidden') return null;

  const color: Record<AttendanceStatus, string> = {
    present: colors.success,
    absent: colors.destructive,
    late: colors.warning,
    half_day: colors.accent,
    excused: colors.textMuted,
  };
  const { recorded, counts } = monthTotals(query.data?.records ?? []);
  // Only a loaded month is a link: the retry button of a failed one must not sit inside another button.
  const open = query.data ? onOpen : undefined;
  return (
    <Card onPress={open}>
      <View style={{ gap: spacing.sm }}>
        <View>
          <Text variant="title" accessibilityRole="header">
            {t('dashboard.myAttendance')}
          </Text>
          {query.data ? <Text tone="muted">{formatMonth(query.data.month)}</Text> : null}
        </View>
        <QueryState query={query} isEmpty={empty} emptyText={t('selfAttendance.noRecords')} hideOnForbidden>
          <StackedBar
            segments={CHART_STATUSES.filter((status) => counts[status] > 0 || ALWAYS_SHOWN.includes(status)).map((status) => ({
              key: status,
              label: settings ? labelFor(settings, status) : t(`attendance.status.${status}`),
              value: counts[status],
              color: color[status],
            }))}
          />
          <Text variant="caption" tone="muted">
            {t('dashboard.attendanceRecorded', { count: recorded })}
          </Text>
        </QueryState>
      </View>
    </Card>
  );
}

/** How many subjects the teacher has in each class and section. Draws nothing without assignments. */
export function SubjectsByClassChart({
  subjects,
  onOpen,
}: {
  subjects: readonly TeacherSubjectAssignment[];
  onOpen?: () => void;
}) {
  const { colors, spacing } = useTheme();
  const { shown, more } = capList(subjectsPerClass(subjects), CLASS_BARS);
  if (shown.length === 0) return null;
  return (
    <Card onPress={onOpen}>
      <View style={{ gap: spacing.sm }}>
        <Text variant="title" accessibilityRole="header">
          {t('dashboard.subjectsByClass')}
        </Text>
        <BarChart rows={shown} color={colors.accent} />
        <MoreCount count={more} />
      </View>
    </Card>
  );
}
