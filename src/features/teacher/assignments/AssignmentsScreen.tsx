// "My classes" (teacher.assignments): every class/section the teacher can mark and every subject
// assignment, from the same `my-classes` response Home uses (one cached request). Read-only.
import { useMemo } from 'react';
import { View } from 'react-native';

import { Banner } from '../../../components/Banner';
import { Card } from '../../../components/Card';
import { ListScreen } from '../../../components/ListScreen';
import { OfflineBanner, savedDataTimestamp } from '../../../components/OfflineBanner';
import { QueryState, queryView } from '../../../components/QueryState';
import { Screen } from '../../../components/Screen';
import { Text } from '../../../components/Text';
import { t } from '../../../i18n';
import { todayIso } from '../../../lib/date';
import { useTheme } from '../../../theme/useTheme';
import { useRefreshSchoolsOnFeatureDenied } from '../../featureDenied';
import { useManualRefresh } from '../../useManualRefresh';
import { useTeacherMyClasses } from '../queries';
import { buildAssignmentSections } from './assignmentsModel';

export default function AssignmentsScreen() {
  const query = useTeacherMyClasses(todayIso());
  useRefreshSchoolsOnFeatureDenied(query.error);
  const { refreshing, onRefresh } = useManualRefresh(() => query.refetch());
  const sections = useMemo(() => (query.data ? buildAssignmentSections(query.data) : []), [query.data]);
  const { spacing } = useTheme();
  const savedFrom = savedDataTimestamp([query]);
  const anyClass = query.data !== undefined && !query.data.restricted;

  // Loading, error, "no access" and hidden states reuse the shared QueryState on a plain screen.
  if (queryView(query) !== 'content') {
    return (
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <QueryState query={query}>{null}</QueryState>
      </Screen>
    );
  }

  return (
    <ListScreen
      sections={sections}
      keyExtractor={(row) => row.key}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListHeaderComponent={
        savedFrom === null && !anyClass ? null : (
          <View style={{ gap: spacing.sm }}>
            <OfflineBanner asOf={savedFrom} />
            {anyClass ? <Banner tone="info">{t('home.anyClass')}</Banner> : null}
          </View>
        )
      }
      renderSectionHeader={({ section }) => (
        <Text variant="title" accessibilityRole="header">
          {t(section.title)}
        </Text>
      )}
      renderItem={({ item }) => (
        <Card>
          <Text variant="bodyLarge">{item.text}</Text>
        </Card>
      )}
      renderSectionFooter={({ section }) =>
        section.data.length === 0 ? <Text tone="muted">{t(section.emptyText)}</Text> : null
      }
    />
  );
}
