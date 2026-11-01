// Guardian child profile (G2): the child's record and placements, from `GET /portal/guardian/students/:id`. Only the child's own data.
// The quick links select this child in the shared context before opening a tab, so the tab shows the same child.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { QueryState } from '../../components/QueryState';
import { Screen } from '../../components/Screen';
import { StatusBadge } from '../../components/StatusBadge';
import { Text } from '../../components/Text';
import { formatDate } from '../../lib/date';
import { t } from '../../i18n';
import { useTheme } from '../../theme/useTheme';
import { useTenantSettings } from '../queries';
import { useGuardianChild } from './GuardianChildContext';
import { useGuardianStudent } from './queries';

export default function GuardianChildProfileScreen() {
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  const router = useRouter();
  const { select } = useGuardianChild();
  const { spacing } = useTheme();
  const calendar = useTenantSettings().data?.calendarPreference ?? 'gregorian';
  const query = useGuardianStudent(studentId ?? null);
  const profile = query.data;

  const openTab = (path: '/guardian/attendance' | '/guardian/results' | '/guardian/fees') => {
    if (studentId) select(studentId);
    router.navigate(path);
  };

  return (
    <Screen refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <QueryState query={query}>
        {profile ? (
          <View style={{ gap: spacing.md }}>
            <Card chevron={false}>
              <Text variant="title">{profile.student.fullName}</Text>
              <Text tone="muted">{t('guardian.student.admission', { number: profile.student.admissionNumber })}</Text>
              <StatusBadge
                label={profile.student.status === 'active' ? t('guardian.student.active') : t('guardian.student.inactive')}
                tone={profile.student.status === 'active' ? 'success' : 'neutral'}
              />
            </Card>
            <Text variant="title">{t('guardian.student.placements')}</Text>
            {profile.enrollments.length === 0 ? (
              <Text tone="muted">{t('guardian.student.noPlacement')}</Text>
            ) : (
              profile.enrollments.map((enrollment) => (
                <Card key={enrollment.id} chevron={false}>
                  <Text variant="title">{`${enrollment.className}${enrollment.sectionName ? ` · ${enrollment.sectionName}` : ''}`}</Text>
                  <Text tone="muted">{enrollment.academicYearLabel}</Text>
                  <Text>{t('guardian.student.enrolledOn', { date: formatDate(enrollment.enrolledAt.slice(0, 10), calendar) })}</Text>
                </Card>
              ))
            )}
            <View style={{ gap: spacing.sm }}>
              <Button title={t('tabs.attendance')} variant="link" onPress={() => openTab('/guardian/attendance')} />
              <Button title={t('guardian.results.title')} variant="link" onPress={() => openTab('/guardian/results')} />
              <Button title={t('guardian.fees.title')} variant="link" onPress={() => openTab('/guardian/fees')} />
            </View>
          </View>
        ) : null}
      </QueryState>
    </Screen>
  );
}
