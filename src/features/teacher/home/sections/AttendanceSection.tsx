import type { UseQueryResult } from '@tanstack/react-query';

import type { TeacherMyClasses, TeacherPlacement } from '../../../../api/types/portal';
import { Banner } from '../../../../components/Banner';
import { Card } from '../../../../components/Card';
import { Text } from '../../../../components/Text';
import { t } from '../../../../i18n';
import { placementLabel } from '../../placement';
import { capList } from '../homeModel';
import { MoreCount, Section } from './Section';

/**
 * The classes the teacher can mark today. A card opens that class's roster; "+N more" opens the
 * Attendance tab with the full list. `restricted: false` = may mark any class (`attendance.mark_any`).
 */
export function AttendanceSection({
  query,
  onOpen,
  onMore,
}: {
  query: UseQueryResult<TeacherMyClasses>;
  /** Opens one class's roster; cards are plain (not pressable) without it. */
  onOpen?: (placement: TeacherPlacement) => void;
  /** Opens the full list; undefined renders plain text. */
  onMore?: () => void;
}) {
  const classes = query.data?.classes ?? [];
  const { shown, more } = capList(classes);
  return (
    <Section
      title={t('home.attendance')}
      hint={t('home.attendanceHint')}
      query={query}
      isEmpty={classes.length === 0}
      emptyText={t('home.noClasses')}
    >
      {query.data && !query.data.restricted ? <Banner tone="info">{t('home.anyClass')}</Banner> : null}
      {shown.map((placement) => (
        <Card
          key={`${placement.classId}:${placement.sectionId ?? 'none'}`}
          onPress={onOpen ? () => onOpen(placement) : undefined}
          accessibilityLabel={onOpen ? t('attendance.openClass', { name: placementLabel(placement) }) : undefined}
        >
          <Text variant="bodyLarge">{placementLabel(placement)}</Text>
        </Card>
      ))}
      <MoreCount count={more} onPress={onMore} />
    </Section>
  );
}
