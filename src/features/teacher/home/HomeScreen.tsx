// Teacher landing page (docs/project/TEACHER_HOME_PLAN.md). Composed from `my-classes` and `exams`
// (there is no `/portal/teacher/home`); read-only, so it shows backend state and nothing else.
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { Banner } from '../../../components/Banner';
import { Card } from '../../../components/Card';
import { OfflineBanner, savedDataTimestamp } from '../../../components/OfflineBanner';
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
import { TEACHER_ATTENDANCE_ACCESS, TEACHER_MARKS_ACCESS } from '../access';
import { ATTENDANCE_TAB_HREF, rosterHref } from '../attendance/routes';
import { useTeacherExams, useTeacherMyClasses } from '../queries';
import { buildExamCards, returnedCount } from './homeModel';
import { AttendanceSection } from './sections/AttendanceSection';
import { MarksProgressChart, SubjectsByClassChart } from './sections/ChartsSection';
import { MarksSection } from './sections/MarksSection';
import { SubjectsSection } from './sections/SubjectsSection';

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
        {name ? t('home.greeting', { name }) : t('shell.home')}
      </Text>
      {school ? <Text variant="bodyLarge">{school}</Text> : null}
      {calendar ? (
        <Text>
          {formatDate(today, calendar)}
          {alternate ? <Text tone="muted">{` · ${alternate}`}</Text> : null}
        </Text>
      ) : null}
    </View>
  );
}

/** A count over a label on a tinted card (the summary row). Two fit a phone row; a third wraps under them. */
function StatTile({ value, label, tint }: { value: number; label: string; tint: string }) {
  return (
    <View style={{ flex: 1, minWidth: 140 }}>
      <Card tint={tint} accessibilityLabel={`${label}: ${value}`}>
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

  const classes = useTeacherMyClasses(todayIso());
  const exams = useTeacherExams(showMarks);
  const cards = useMemo(
    () => (showMarks ? buildExamCards(exams.data ?? []) : []),
    [showMarks, exams.data],
  );
  const returned = returnedCount(cards);

  // Offline with cached data: say so and how old it is.
  const savedFrom = savedDataTimestamp(showMarks ? [classes, exams] : [classes]);
  const updatedAt = Math.max(classes.dataUpdatedAt, showMarks ? exams.dataUpdatedAt : 0);

  useRefreshSchoolsOnFeatureDenied(classes.error, exams.error);
  const { refreshing, onRefresh } = useManualRefresh(() =>
    Promise.all([classes.refetch(), showMarks ? exams.refetch() : null]),
  );

  // "+N more" opens the full list, once My classes (inside the Academic tab) is visible to this user.
  const features = useVisibleFeatures('teacher');
  const myClasses = features.find((feature) => feature.id === 'teacher.assignments');
  const openAssignments = myClasses ? () => router.push(menuHref(myClasses)) : undefined;

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <HomeHeader name={me.data?.fullName} school={school?.name} calendar={calendar} />
      <OfflineBanner asOf={savedFrom} />
      {returned > 0 ? <Banner tone="warning">{t('home.returned', { count: returned })}</Banner> : null}
      {classes.data ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <StatTile value={classes.data.classes.length} label={t('dashboard.classes')} tint={colors.accent} />
          <StatTile value={classes.data.subjects.length} label={t('dashboard.subjects')} tint={colors.success} />
          {showMarks && exams.data ? (
            <StatTile value={cards.length} label={t('dashboard.openExams')} tint={colors.warning} />
          ) : null}
        </View>
      ) : null}
      {showMarks && exams.data ? <MarksProgressChart cards={cards} /> : null}
      {classes.data ? <SubjectsByClassChart subjects={classes.data.subjects} /> : null}
      {showAttendance ? (
        <AttendanceSection
          query={classes}
          onOpen={(placement) => router.push(rosterHref(placement))}
          onMore={() => router.push(ATTENDANCE_TAB_HREF)}
        />
      ) : null}
      {showMarks ? <MarksSection query={exams} cards={cards} /> : null}
      <SubjectsSection query={classes} hideOnForbidden={showAttendance} onMore={openAssignments} />
      {updatedAt > 0 && savedFrom === null && calendar ? (
        <Text variant="caption" tone="muted">
          {t('home.updated', { when: formatTimestamp(updatedAt, calendar) })}
        </Text>
      ) : null}
    </Screen>
  );
}
