import { View } from 'react-native';

import { useTheme } from '../theme/useTheme';
import { Text } from './Text';

export interface StackedBarSegment {
  key: string;
  label: string;
  value: number;
  /** A palette colour. The label and the count under the bar carry the meaning too, so colour is never the only signal. */
  color: string;
}

const BAR_HEIGHT = 14;
const LEGEND_SWATCH = 10;
/** The surface-coloured gap between touching segments. */
const SEGMENT_GAP = 2;

/**
 * Part of a whole as one bar (a "100% stacked bar"): a segment per state sized by its count, then a legend with the
 * counts. Zero-count states stay in the legend and out of the bar. Read as one element by a screen reader
 * ("Submitted: 5, Returned: 1, …"). Draws nothing when every count is zero.
 */
export function StackedBar({ segments }: { segments: readonly StackedBarSegment[] }) {
  const { spacing, radius } = useTheme();
  const drawn = segments.filter((segment) => segment.value > 0);
  if (drawn.length === 0) return null;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={segments.map((segment) => `${segment.label}: ${segment.value}`).join(', ')}
      style={{ gap: spacing.sm }}
    >
      <View style={{ flexDirection: 'row', gap: SEGMENT_GAP, height: BAR_HEIGHT, borderRadius: radius.pill, overflow: 'hidden' }}>
        {/* Destructured: a `.value` read straight inside a style makes Reanimated's Babel plugin treat it as a shared value. */}
        {drawn.map(({ key, value, color }) => (
          <View key={key} style={{ flex: value, backgroundColor: color }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, rowGap: spacing.xs }}>
        {segments.map((segment) => (
          <View key={segment.key} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <View
              style={{ width: LEGEND_SWATCH, height: LEGEND_SWATCH, borderRadius: radius.sm, backgroundColor: segment.color }}
            />
            <Text variant="caption">{segment.label}</Text>
            <Text variant="caption" style={{ fontWeight: '700' }}>
              {String(segment.value)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
