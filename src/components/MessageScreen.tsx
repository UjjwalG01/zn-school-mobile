import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '../theme/useTheme';
import { Screen } from './Screen';
import { Text } from './Text';

export interface MessageScreenProps {
  title: string;
  body?: string;
  /** Buttons, stacked under the message. */
  children?: ReactNode;
}

/** Full-screen state: title + explanation + actions (empty, error, blocked states). */
export function MessageScreen({ title, body, children }: MessageScreenProps) {
  const { spacing } = useTheme();
  return (
    <Screen>
      <View style={{ paddingTop: spacing.xxl, gap: spacing.sm }}>
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
        {body ? (
          <Text variant="bodyLarge" tone="muted">
            {body}
          </Text>
        ) : null}
      </View>
      {children ? <View style={{ gap: spacing.sm }}>{children}</View> : null}
    </Screen>
  );
}
