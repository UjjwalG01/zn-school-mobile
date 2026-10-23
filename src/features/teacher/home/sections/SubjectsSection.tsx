import type { UseQueryResult } from '@tanstack/react-query';

import type { TeacherMyClasses } from '../../../../api/types/portal';
import { Card } from '../../../../components/Card';
import { Text } from '../../../../components/Text';
import { t } from '../../../../i18n';
import { placementLabel } from '../../placement';
import { capList } from '../homeModel';
import { MoreCount, Section } from './Section';

/** The teacher's subject assignments, from the same `my-classes` response as Attendance. */
export function SubjectsSection({
  query,
  hideOnForbidden,
  onMore,
}: {
  query: UseQueryResult<TeacherMyClasses>;
  /** True when the Attendance block already shows the "no access" text for the same response. */
  hideOnForbidden: boolean;
  /** Opens the full list; undefined when My classes is not available. */
  onMore?: () => void;
}) {
  const subjects = query.data?.subjects ?? [];
  const { shown, more } = capList(subjects);
  return (
    <Section
      title={t('home.subjects')}
      query={query}
      isEmpty={subjects.length === 0}
      emptyText={t('home.noSubjects')}
      hideOnForbidden={hideOnForbidden}
    >
      <Card>
        {shown.map((subject) => (
          <Text key={`${subject.subjectOfferingId}:${subject.sectionId ?? 'none'}`}>
            {`${subject.subjectName} — ${placementLabel(subject)}`}
          </Text>
        ))}
      </Card>
      <MoreCount count={more} onPress={onMore} />
    </Section>
  );
}
