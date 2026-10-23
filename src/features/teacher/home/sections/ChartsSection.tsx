import { View } from 'react-native';

import type { TeacherSubjectAssignment } from '../../../../api/types/portal';
import { BarChart } from '../../../../components/BarChart';
import { Card } from '../../../../components/Card';
import { StackedBar } from '../../../../components/StackedBar';
import { Text } from '../../../../components/Text';
import { t } from '../../../../i18n';
import { useTheme } from '../../../../theme/useTheme';
import { capList, type ExamCard, progressTotals, subjectsPerClass } from '../homeModel';
import { MoreCount } from './Section';

/** How many classes the bar chart lists; the rest are a "+N more" line. */
const CLASS_BARS = 6;

/**
 * Where the marks entry stands: the teacher's subjects, across every open exam, by state. Counts the backend's own
 * submission states, decides nothing. Draws nothing without subjects.
 */
export function MarksProgressChart({ cards }: { cards: readonly ExamCard[] }) {
  const { colors, spacing } = useTheme();
  const { total, counts } = progressTotals(cards);
  if (total === 0) return null;
  return (
    <Card>
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

/** How many subjects the teacher has in each class and section. Draws nothing without assignments. */
export function SubjectsByClassChart({ subjects }: { subjects: readonly TeacherSubjectAssignment[] }) {
  const { colors, spacing } = useTheme();
  const { shown, more } = capList(subjectsPerClass(subjects), CLASS_BARS);
  if (shown.length === 0) return null;
  return (
    <Card>
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
