// Teacher landing page (docs/project/TEACHER_HOME_PLAN.md). Composed from `my-classes`, `exams`, the person's own month of
// attendance and the Academic Calendar (there is no `/portal/teacher/home`); read-only, so it shows backend state and nothing
// else. Order: summary tiles, the calendar with its events and notices, then summaries only: each opens its own page.
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { Banner } from '../../../components/Banner';
import { Card } from '../../../components/Card';
import { OfflineBanner, savedDataTimestamp } from '../../../components/OfflineBanner';
import { QueryState } from '../../../components/QueryState';
import { Screen } from '../../../components/Screen';
import { Text } from '../../../components/Text';
import { useMe, useMySchools } from '../../../auth/queries';
import { useSession } from '../../../auth/session';
import { t } from '../../../i18n';
import {
  type CalendarPreference,
  formatAlternateDate,
  formatDate,
  formatTimestamp,
  todayIso,
} from '../../../lib/date';
import { useTheme } from '../../../theme/useTheme';
import { useRefreshSchoolsOnFeatureDenied } from '../../featureDenied';
import { useTenantSettings } from '../../queries';
import { menuHref } from '../../routes';
import { useManualRefresh } from '../../useManualRefresh';
import { useVisibilityContext, useVisibleFeatures } from '../../useVisibleFeatures';
import { isFeatureVisible } from '../../visibility';
import {
  TEACHER_ATTENDANCE_ACCESS,
  TEACHER_CALENDAR_ACCESS,
  TEACHER_MARKS_ACCESS,
  TEACHER_SELF_ATTENDANCE_ACCESS,
} from '../access';
import { ATTENDANCE_TAB_HREF, SELF_ATTENDANCE_TAB_HREF } from '../attendance/routes';
import { DashboardCalendar } from '../calendar/CalendarSections';
import { useCalendarBoard } from '../calendar/useCalendarBoard';
import { useTeacherExams, useTeacherMyClasses } from '../queries';
import { useMyAttendance } from '../selfAttendance/queries';
import { buildExamCards, returnedCount } from './homeModel';
import { MarksProgressChart, MyAttendanceChart, SubjectsByClassChart } from './sections/ChartsSection';

function HomeHeader({
  name,
  school,
  calendar,
}: {
  name: string | undefined;
  school: string | undefined;
  calendar: CalendarPreference | undefined;
}) {
  const { spacing } = useTheme();
  // The date line waits for the tenant's calendar setting; no calendar is assumed.
  const today = todayIso();
  const alternate = calendar ? formatAlternateDate(today, calendar) : null;
  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="headline" accessibilityRole="header">
        {/* {name ? t('home.greeting', { name }) : t('shell.home')} */}
        {school ? <Text style={{ fontWeight: 'bold' }} variant="headline">{school.toUpperCase()}</Text> : "Orbis Education"}
      </Text>
      {calendar ? (
        <Text style={{ fontWeight: '600' }} >
          {formatDate(today, calendar)}
          {alternate ? <Text tone="muted">{` · ${alternate}`}</Text> : null}
        </Text>
      ) : null}
    </View>
  );
}

/** A count over a label on a tinted card (the summary row); it opens its page when it has one. Two fit a phone row; a third wraps under them. */
function StatTile({
  value,
  label,
  tint,
  onOpen,
}: {
  value: number;
  label: string;
  tint: string;
  onOpen?: () => void;
}) {
  return (
    <View style={{ flex: 1, minWidth: 140 }}>
      <Card tint={tint} onPress={onOpen} accessibilityLabel={`${label}: ${value}`}>
        <Text variant="headline">{String(value)}</Text>
        <Text variant="caption" tone="muted">
          {label}
        </Text>
      </Card>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { tenantId } = useSession();
  const { colors, spacing } = useTheme();
  const me = useMe();
  const school = useMySchools().data?.find((candidate) => candidate.tenantId === tenantId);
  const calendar = useTenantSettings().data?.calendarPreference;

  // Section gates: the same visibility rule the tabs use, applied to areas that have no tab yet.
  const ctx = useVisibilityContext('teacher');
  const showAttendance = ctx !== null && isFeatureVisible(TEACHER_ATTENDANCE_ACCESS, ctx);
  const showMarks = ctx !== null && isFeatureVisible(TEACHER_MARKS_ACCESS, ctx);
  const showSelfAttendance = ctx !== null && isFeatureVisible(TEACHER_SELF_ATTENDANCE_ACCESS, ctx);
  const showCalendar = ctx !== null && isFeatureVisible(TEACHER_CALENDAR_ACCESS, ctx);

  const classes = useTeacherMyClasses(todayIso());
  const exams = useTeacherExams(showMarks);
  // The one extra read of the "My Attendance This Month" chart; the My Attendance screen shares its cache entry.
  const selfAttendance = useMyAttendance(null, showSelfAttendance);
  // The Calendar screen's month, upcoming window and notices (same cache entries, so opening it costs nothing when warm).
  const board = useCalendarBoard(showCalendar);
  const cards = useMemo(
    () => (showMarks ? buildExamCards(exams.data ?? []) : []),
    [showMarks, exams.data],
  );
  const returned = returnedCount(cards);

  // Offline with cached data: say so and how old it is. A read that never ran has no data and no error, so it adds nothing.
  const savedFrom = savedDataTimestamp([classes, exams, board.month, board.upcoming, board.notices]);
  const updatedAt = Math.max(classes.dataUpdatedAt, showMarks ? exams.dataUpdatedAt : 0);

  useRefreshSchoolsOnFeatureDenied(classes.error, exams.error);
  const { refreshing, onRefresh } = useManualRefresh(() =>
    Promise.all([
      classes.refetch(),
      showMarks ? exams.refetch() : null,
      showSelfAttendance ? selfAttendance.refetch() : null,
      showCalendar ? board.refetchAll() : null,
    ]),
  );

  // Each summary opens the page that holds its detail, once that page is visible to this user.
  const features = useVisibleFeatures('teacher');
  const opener = (id: string) => {
    const feature = features.find((candidate) => candidate.id === id);
    return feature ? () => router.push(menuHref(feature)) : undefined;
  };
  const openAssignments = opener('teacher.assignments');
  const openMarks = opener('teacher.marks');
  const openCalendar = opener('teacher.calendar');
  const openAttendance = showAttendance ? () => router.push(ATTENDANCE_TAB_HREF) : undefined;
  const openSelfAttendance = () => router.push(SELF_ATTENDANCE_TAB_HREF);

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <HomeHeader name={me.data?.fullName} school={school?.name} calendar={calendar} />
      <OfflineBanner asOf={savedFrom} />
      {returned > 0 ? <Banner tone="warning">{t('home.returned', { count: returned })}</Banner> : null}
      {classes.data ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <StatTile
            value={classes.data.classes.length}
            label={t('dashboard.classes')}
            tint={colors.accent}
            onOpen={openAttendance ?? openAssignments}
          />
          <StatTile
            value={classes.data.subjects.length}
            label={t('dashboard.subjects')}
            tint={colors.success}
            onOpen={openAssignments}
          />
          {showMarks && exams.data ? (
            <StatTile value={cards.length} label={t('dashboard.openExams')} tint={colors.warning} onOpen={openMarks} />
          ) : null}
        </View>
      ) : (
        // The state of the one read the tiles and the subjects chart share: loading, no access, offline, retry.
        <QueryState query={classes}>{null}</QueryState>
      )}
      {showCalendar ? <DashboardCalendar board={board} onOpen={openCalendar} /> : null}
      {showSelfAttendance ? <MyAttendanceChart query={selfAttendance} onOpen={openSelfAttendance} /> : null}
      {showMarks ? (
        exams.data ? (
          <MarksProgressChart cards={cards} onOpen={openMarks} />
        ) : (
          // No staff link (403) hides it; other failures keep a retry.
          <QueryState query={exams} hideOnForbidden>
            {null}
          </QueryState>
        )
      ) : null}
      {classes.data ? <SubjectsByClassChart subjects={classes.data.subjects} onOpen={openAssignments} /> : null}
      {updatedAt > 0 && savedFrom === null && calendar ? (
        <Text variant="caption" tone="muted">
          {t('home.updated', { when: formatTimestamp(updatedAt, calendar) })}
        </Text>
      ) : null}
    </Screen>
  );
}
