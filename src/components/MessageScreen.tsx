import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '../theme/useTheme';
import { BrandHeader } from './BrandHeader';
import { Screen } from './Screen';
import { Text } from './Text';

export interface MessageScreenProps {
  title: string;
  body?: string;
  /** Buttons, stacked under the message. */
  children?: ReactNode;
}

/** Full-screen state: the title in the brand header, then the explanation and actions (empty, error, blocked states). */
export function MessageScreen({ title, body, children }: MessageScreenProps) {
  const { spacing } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <BrandHeader title={title} />
      <Screen>
        {body ? (
          <Text variant="bodyLarge" tone="muted">
            {body}
          </Text>
        ) : null}
        {children ? <View style={{ gap: spacing.sm }}>{children}</View> : null}
      </Screen>
    </View>
  );
}
