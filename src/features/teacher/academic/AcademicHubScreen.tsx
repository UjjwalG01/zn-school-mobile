// Academic tab, first screen: a hub over what already exists (My classes, My subjects, Open exams,
// all read-only) plus non-clickable "Coming soon" rows for what is planned (docs/project/
// TEACHER_APP_PLAN.md §5, owner decision D5). The cards come from the registry: every visible `menu`
// feature that names this tab in `tab`.
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { Banner } from '../../../components/Banner';
import { Card } from '../../../components/Card';
import { OfflineBanner, savedDataTimestamp } from '../../../components/OfflineBanner';
import { Screen } from '../../../components/Screen';
import { StatusBadge } from '../../../components/StatusBadge';
import { Text } from '../../../components/Text';
import { t } from '../../../i18n';
import { todayIso } from '../../../lib/date';
import { useTheme } from '../../../theme/useTheme';
import { useRefreshSchoolsOnFeatureDenied } from '../../featureDenied';
import { menuHref } from '../../routes';
import { useManualRefresh } from '../../useManualRefresh';
import { useVisibilityContext, useVisibleFeatures } from '../../useVisibleFeatures';
import { isFeatureVisible } from '../../visibility';
import { TEACHER_ATTENDANCE_ACCESS, TEACHER_MARKS_ACCESS } from '../access';
import { buildExamCards } from '../home/homeModel';
import { MarksSection } from '../home/sections/MarksSection';
import { SubjectsSection } from '../home/sections/SubjectsSection';
import { useTeacherExams, useTeacherMyClasses } from '../queries';
import { teacherAcademicFeature } from './manifest';

// Flat and muted on purpose: a card here would look like the tappable My classes card above it.
function ComingSoonRow({ label }: { label: string }) {
  const { spacing } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${t('academic.comingSoon')}`}
      accessibilityState={{ disabled: true }}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}
    >
      <Text tone="muted">{label}</Text>
      <StatusBadge label={t('academic.comingSoon')} tone="neutral" />
    </View>
  );
}

export default function AcademicHubScreen() {
  const router = useRouter();
  const { spacing } = useTheme();
  const ctx = useVisibilityContext('teacher');
  const menu = useVisibleFeatures('teacher').filter((feature) => feature.tab === teacherAcademicFeature.id);
  const showMarks = ctx !== null && isFeatureVisible(TEACHER_MARKS_ACCESS, ctx);
  const showAttendance = ctx !== null && isFeatureVisible(TEACHER_ATTENDANCE_ACCESS, ctx);

  // Both reads are already cached by Home, so opening the hub is free when warm.
  const classes = useTeacherMyClasses(todayIso());
  const exams = useTeacherExams(showMarks);
  const cards = useMemo(
    () => (showMarks ? buildExamCards(exams.data ?? []) : []),
    [showMarks, exams.data],
  );
  const savedFrom = savedDataTimestamp(showMarks ? [classes, exams] : [classes]);
  useRefreshSchoolsOnFeatureDenied(classes.error, exams.error);
  const { refreshing, onRefresh } = useManualRefresh(() =>
    Promise.all([classes.refetch(), showMarks ? exams.refetch() : null]),
  );

  const myClasses = menu.find((feature) => feature.id === 'teacher.assignments');
  const nothingEnabled = menu.length === 0 && !showMarks && !showAttendance;

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <OfflineBanner asOf={savedFrom} />
      {nothingEnabled ? <Banner tone="info">{t('academic.empty')}</Banner> : null}
      {menu.map((feature) => (
        <Card
          key={feature.id}
          onPress={() => router.push(menuHref(feature))}
          accessibilityLabel={t(feature.title)}
        >
          <Text variant="bodyLarge">{t(feature.title)}</Text>
        </Card>
      ))}
      <SubjectsSection
        query={classes}
        hideOnForbidden
        onMore={myClasses ? () => router.push(menuHref(myClasses)) : undefined}
      />
      {showMarks ? <MarksSection query={exams} cards={cards} title={t('academic.exams')} /> : null}
      <View style={{ gap: spacing.sm }}>
        <Text variant="title" accessibilityRole="header">
          {t('academic.comingSoon')}
        </Text>
        <ComingSoonRow label={t('academic.routine')} />
      </View>
    </Screen>
  );
}
