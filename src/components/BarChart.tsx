import { View } from 'react-native';

import { withAlpha } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Text } from './Text';

export interface BarChartRow {
  key: string;
  label: string;
  value: number;
}

const BAR_HEIGHT = 10;
/** The empty part of a bar is the bar colour at this opacity, so the whole length reads as one scale. */
const TRACK_OPACITY = 0.15;

/**
 * Horizontal bars to compare counts: the label and the value on one line, the bar under it (long class names do not
 * squeeze the bar). Every bar starts at zero and the longest fills the width. Each row is read as one element
 * ("Class 8 · A: 3"). Draws nothing when there is nothing above zero.
 */
export function BarChart({ rows, color }: { rows: readonly BarChartRow[]; color: string }) {
  const { spacing, radius } = useTheme();
  const max = rows.reduce((largest, row) => Math.max(largest, row.value), 0);
  if (max === 0) return null;
  return (
    <View style={{ gap: spacing.md }}>
      {rows.map((row) => (
        <View key={row.key} accessible accessibilityLabel={`${row.label}: ${row.value}`} style={{ gap: spacing.xs }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
            <Text numberOfLines={1} style={{ flex: 1 }}>
              {row.label}
            </Text>
            <Text style={{ fontWeight: '700' }}>{String(row.value)}</Text>
          </View>
          <View
            style={{
              height: BAR_HEIGHT,
              borderRadius: radius.pill,
              backgroundColor: withAlpha(color, TRACK_OPACITY),
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${(row.value / max) * 100}%`,
                height: BAR_HEIGHT,
                borderRadius: radius.pill,
                backgroundColor: color,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}
