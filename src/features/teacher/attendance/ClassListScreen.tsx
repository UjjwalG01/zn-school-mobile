// Attendance tab, first screen: the classes this teacher can mark (docs/project/ATTENDANCE_PLAN.md
// §3.8). It reads the same cached `my-classes` response as Home, so opening it is free when warm.
import { Redirect, useRouter } from 'expo-router';
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
import { placementLabel } from '../placement';
import { useTeacherMyClasses } from '../queries';
import { rosterHref } from './routes';

export interface ClassListScreenProps {
  /** Keep the list for a one-class teacher: the redirect would replace the tab root and hide the other subtab. */
  skipSingle?: boolean;
}

export default function ClassListScreen({ skipSingle = false }: ClassListScreenProps) {
  const router = useRouter();
  const { spacing } = useTheme();
  const query = useTeacherMyClasses(todayIso());
  useRefreshSchoolsOnFeatureDenied(query.error);
  const { refreshing, onRefresh } = useManualRefresh(() => query.refetch());

  const classes = query.data?.classes ?? [];
  const view = queryView(query, { isEmpty: classes.length === 0 });
  if (view !== 'content') {
    return (
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <QueryState query={query} isEmpty={classes.length === 0} emptyText={t('home.noClasses')}>
          {null}
        </QueryState>
      </Screen>
    );
  }

  // One class to mark (the usual class teacher): skip the list. The roster replaces this screen, so
  // there is no back button to loop on.
  if (classes.length === 1 && !skipSingle) return <Redirect href={rosterHref(classes[0]!)} />;

  const savedFrom = savedDataTimestamp([query]);
  const anyClass = query.data !== undefined && !query.data.restricted;
  return (
    <ListScreen
      sections={[{ data: classes }]}
      keyExtractor={(placement) => `${placement.classId}:${placement.sectionId ?? 'none'}`}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListHeaderComponent={
        savedFrom !== null || anyClass ? (
          <View style={{ gap: spacing.sm }}>
            <OfflineBanner asOf={savedFrom} />
            {anyClass ? <Banner tone="info">{t('home.anyClass')}</Banner> : null}
          </View>
        ) : null
      }
      renderItem={({ item }) => (
        <Card
          onPress={() => router.push(rosterHref(item))}
          accessibilityLabel={t('attendance.openClass', { name: placementLabel(item) })}
        >
          <Text variant="bodyLarge">{placementLabel(item)}</Text>
        </Card>
      )}
    />
  );
}
