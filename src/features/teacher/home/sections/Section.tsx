import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Button } from '../../../../components/Button';
import { QueryState, type QueryStateSource, queryView } from '../../../../components/QueryState';
import { Text } from '../../../../components/Text';
import { t } from '../../../../i18n';
import { useTheme } from '../../../../theme/useTheme';

export interface SectionProps {
  title: string;
  hint?: string;
  query: QueryStateSource;
  isEmpty: boolean;
  emptyText: string;
  hideOnForbidden?: boolean;
  children: ReactNode;
}

/** A titled Home block around one query. A hidden state hides the title too. */
export function Section({
  title,
  hint,
  query,
  isEmpty,
  emptyText,
  hideOnForbidden,
  children,
}: SectionProps) {
  const { spacing } = useTheme();
  if (queryView(query, { isEmpty, hideOnForbidden }) === 'hidden') return null;
  return (
    <View style={{ gap: spacing.sm }}>
      <View>
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
        {hint ? <Text tone="muted">{hint}</Text> : null}
      </View>
      <QueryState query={query} isEmpty={isEmpty} emptyText={emptyText} hideOnForbidden={hideOnForbidden}>
        {children}
      </QueryState>
    </View>
  );
}

/**
 * "+N more" under a capped list; renders nothing when nothing was left out. With `onPress` it is a
 * link to the full list; without it, plain text (the destination feature is not available).
 */
export function MoreCount({ count, onPress }: { count: number; onPress?: () => void }) {
  if (count <= 0) return null;
  const label = t('home.more', { count });
  return onPress ? (
    <Button title={label} variant="link" onPress={onPress} />
  ) : (
    <Text tone="muted">{label}</Text>
  );
}
