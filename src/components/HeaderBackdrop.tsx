import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { type DimensionValue, StyleSheet, View } from 'react-native';

import { withAlpha } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** How faint the motifs are drawn over the brand colour. */
const MOTIF_OPACITY = 0.1;

// School things scattered over the header, as the reference's pattern is. Positions are percentages so the same
// backdrop fits the tall sign-in banner and the short page header. To use artwork instead, put an `<Image>` here.
const MOTIFS: readonly { name: IconName; left: DimensionValue; top: DimensionValue; size: number; rotate: string }[] = [
  { name: 'school-outline', left: '-4%', top: '10%', size: 72, rotate: '-12deg' },
  { name: 'bulb-outline', left: '24%', top: '-12%', size: 40, rotate: '-6deg' },
  { name: 'globe-outline', left: '50%', top: '16%', size: 52, rotate: '0deg' },
  { name: 'book-outline', left: '72%', top: '-8%', size: 64, rotate: '14deg' },
  { name: 'calculator-outline', left: '8%', top: '62%', size: 48, rotate: '8deg' },
  { name: 'pencil-outline', left: '38%', top: '60%', size: 44, rotate: '30deg' },
  { name: 'flask-outline', left: '84%', top: '50%', size: 56, rotate: '-10deg' },
];

/** Faint educational motifs filling the header it is placed in (the parent clips them). Decorative only. */
export function HeaderBackdrop() {
  const { colors } = useTheme();
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {MOTIFS.map(({ name, left, top, size, rotate }) => (
        <Ionicons
          key={name}
          name={name}
          size={size}
          color={withAlpha(colors.textInverse, MOTIF_OPACITY)}
          style={{ position: 'absolute', left, top, transform: [{ rotate }] }}
        />
      ))}
    </View>
  );
}
