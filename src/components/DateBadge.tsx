import { View } from 'react-native';

import { withAlpha } from '../theme/tokens';
import { Text } from './Text';

const BADGE_SIZE = 52;
const BADGE_FILL_OPACITY = 0.14;

/**
 * A round date badge ("01" over "Mar") from the Calendar reference: a ring and a light fill in `color`, the date in the text
 * colour so it stays readable in both schemes. Hidden from screen readers: the row beside it already says the date.
 */
export function DateBadge({ day, month, color }: { day: string; month: string; color: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        minWidth: BADGE_SIZE,
        minHeight: BADGE_SIZE,
        borderRadius: BADGE_SIZE / 2,
        borderWidth: 2,
        borderColor: color,
        backgroundColor: withAlpha(color, BADGE_FILL_OPACITY),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant="bodyLarge" style={{ fontWeight: '700' }}>
        {day}
      </Text>
      <Text variant="caption" tone="muted" style={{ textTransform: 'uppercase' }}>
        {month}
      </Text>
    </View>
  );
}
