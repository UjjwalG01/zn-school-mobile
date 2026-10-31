// Guardian Home (GV-D4, G1 basic): the children linked to the signed-in guardian, one card each. No per-child requests here; a child's
// attendance, results and fees come with their own screens in G3 to G5. Notices and the inbox arrive in G6.
import { View } from 'react-native';

import type { GuardianStudent } from '../../api/portal';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { t } from '../../i18n';
import { useTheme } from '../../theme/useTheme';
import { useGuardianStudents } from './queries';

function StudentCard({ student }: { student: GuardianStudent }) {
  const placement = student.className
    ? t('guardian.home.placement', {
        className: student.className,
        sectionName: student.sectionName ? ` · ${student.sectionName}` : '',
      })
    : t('guardian.home.noPlacement');
  return (
    <Card chevron={false}>
      <Text variant="title">{student.fullName}</Text>
      <Text tone="muted">{student.admissionNumber}</Text>
      <Text>{placement}</Text>
    </Card>
  );
}

export default function GuardianHomeScreen() {
  const { spacing } = useTheme();
  const query = useGuardianStudents();
  const students = query.data ?? [];

  return (
    <Screen refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <Text variant="title">{t('guardian.home.title')}</Text>
      {query.isPending ? <Text tone="muted">{t('common.loading')}</Text> : null}
      {query.isError ? (
        <View style={{ gap: spacing.sm }}>
          <Text tone="error">{t('guardian.home.error')}</Text>
          <Button title={t('common.retry')} variant="link" onPress={() => void query.refetch()} />
        </View>
      ) : null}
      {query.isSuccess && students.length === 0 ? <Text tone="muted">{t('guardian.home.empty')}</Text> : null}
      {students.map((student) => (
        <StudentCard key={student.studentId} student={student} />
      ))}
    </Screen>
  );
}
