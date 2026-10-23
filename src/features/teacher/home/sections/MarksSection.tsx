import type { UseQueryResult } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';

import type { TeacherExam } from '../../../../api/types/portal';
import { Card } from '../../../../components/Card';
import { StatusBadge } from '../../../../components/StatusBadge';
import { Text } from '../../../../components/Text';
import { t } from '../../../../i18n';
import { useTheme } from '../../../../theme/useTheme';
import { capList, type ExamCard, progressTone } from '../homeModel';
import { MoreCount, Section } from './Section';

/**
 * Exams open for marks entry with the teacher's subjects and their submission state (backend
 * state only). Hidden entirely when the backend answers 403 (no staff link). Cards are not
 * pressable until the Marks feature lands.
 */
export function MarksSection({
  query,
  cards,
  title = t('home.marks'),
}: {
  query: UseQueryResult<TeacherExam[]>;
  cards: readonly ExamCard[];
  /** The Academic hub shows the same list as "Open exams". */
  title?: string;
}) {
  const { spacing } = useTheme();
  const { shown, more } = capList(cards);
  return (
    <Section
      title={title}
      query={query}
      isEmpty={cards.length === 0}
      emptyText={t('home.noExams')}
      hideOnForbidden
    >
      {shown.map((card) => (
        <Card key={card.key}>
          <Text variant="bodyLarge" style={styles.examTitle}>
            {card.title}
          </Text>
          <Text tone="muted">{card.subtitle}</Text>
          {card.subjects.map((subject) => (
            <View key={subject.key} style={[styles.subject, { gap: spacing.sm, paddingTop: spacing.sm }]}>
              <Text style={styles.subjectName}>{subject.name}</Text>
              <StatusBadge
                label={t(`home.progress.${subject.progress}`)}
                tone={progressTone(subject.progress)}
              />
            </View>
          ))}
        </Card>
      ))}
      <MoreCount count={more} />
    </Section>
  );
}

const styles = StyleSheet.create({
  examTitle: { fontWeight: '600' },
  subject: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subjectName: { flex: 1 },
});
