import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { errorActionOf } from '../api/errors';
import { t } from '../i18n';
import { useTheme } from '../theme/useTheme';
import { Button } from './Button';
import { Text } from './Text';

/** The part of a TanStack `useQuery` result this component reads. */
export interface QueryStateSource {
  data: unknown;
  error: Error | null;
  refetch: () => unknown;
}

export type QueryView = 'loading' | 'hidden' | 'noAccess' | 'offline' | 'failed' | 'empty' | 'content';

export interface QueryViewOptions {
  isEmpty?: boolean;
  /** A plain 403 hides the section instead of showing "no access" (Marks without a staff link). */
  hideOnForbidden?: boolean;
}

/**
 * Which view a query is in. Cached data always wins (a failed refetch keeps showing it; the screen
 * adds its own "saved data" banner). Errors the session layer already handles (logout, school
 * dropped, suspended, license) and `feature-denied` render nothing here.
 */
export function queryView(
  query: QueryStateSource,
  { isEmpty = false, hideOnForbidden = false }: QueryViewOptions = {},
): QueryView {
  if (query.data !== undefined) return isEmpty ? 'empty' : 'content';
  if (!query.error) return 'loading';

  switch (errorActionOf(query.error)) {
    case 'forbidden':
      return hideOnForbidden ? 'hidden' : 'noAccess';
    case 'feature-denied':
    case 'session-expired':
    case 'drop-school':
    case 'school-suspended':
    case 'license-blocked':
      return 'hidden';
    case 'offline':
      return 'offline';
    default:
      return 'failed';
  }
}

export interface QueryStateProps extends QueryViewOptions {
  query: QueryStateSource;
  emptyText?: string;
  children: ReactNode;
}

/** Loading / error / empty / content for one query, so no screen hand-rolls the four states. */
export function QueryState({ query, isEmpty, emptyText, hideOnForbidden, children }: QueryStateProps) {
  const { colors, spacing } = useTheme();
  const view = queryView(query, { isEmpty, hideOnForbidden });

  switch (view) {
    case 'content':
      return <>{children}</>;
    case 'hidden':
      return null;
    case 'loading':
      return (
        <View style={[styles.row, { gap: spacing.sm }]}>
          <ActivityIndicator color={colors.accent} />
          <Text tone="muted">{t('common.loading')}</Text>
        </View>
      );
    case 'empty':
      return <Text tone="muted">{emptyText ?? ''}</Text>;
    case 'noAccess':
      return <Text tone="muted">{t('common.noAccess')}</Text>;
    default:
      return (
        <View style={{ gap: spacing.xs }}>
          <Text tone="muted">{view === 'offline' ? t('common.offline') : t('common.loadFailed')}</Text>
          <Button title={t('common.retry')} variant="link" onPress={() => void query.refetch()} />
        </View>
      );
  }
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
