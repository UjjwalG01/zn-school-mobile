import { StyleSheet, View } from 'react-native';

import { Text } from '../../../../components/Text';
import { t } from '../../../../i18n';
import { useTheme } from '../../../../theme/useTheme';
import { formatMarks, type MarkColumn } from '../marksModel';
import { ID_MIN_WIDTH, ROLL_WIDTH } from './MarkCell';

/**
 * The column titles above the student rows, kept on screen while the rows scroll. It wraps exactly where a row does, so
 * every title stays over its box. The maximum is shown once here ("/80") instead of in every row.
 */
export function MarksTableHeader({ columns, cellWidth }: { columns: readonly MarkColumn[]; cellWidth: number }) {
  const { colors, spacing } = useTheme();
  return (
    <View
      accessibilityRole="header"
      style={[
        styles.row,
        { backgroundColor: colors.bg, borderBottomColor: colors.border, columnGap: spacing.sm, rowGap: spacing.xs, paddingVertical: spacing.sm },
      ]}
    >
      <View style={[styles.id, { minWidth: ID_MIN_WIDTH }]}>
        <Text variant="caption" tone="muted" style={[styles.bold, { width: ROLL_WIDTH }]}>
          {t('marks.header.roll')}
        </Text>
        <Text variant="caption" tone="muted" style={[styles.bold, styles.fill]}>
          {t('marks.header.student')}
        </Text>
      </View>
      <View style={[styles.cells, { gap: spacing.xs }]}>
        {columns.map((column) => (
          <View key={column.key} style={{ width: cellWidth, alignItems: 'center' }}>
            {/* Two lines, centred: a long Nepali title ("प्रयोगात्मक") is wider than a three-column box. */}
            <Text variant="caption" style={[styles.bold, { textAlign: 'center' }]} numberOfLines={2}>
              {column.title}
            </Text>
            <Text variant="caption" tone="muted">
              {column.component ? `/ ${formatMarks(column.component.maxMarks)}` : '–'}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  id: { flex: 1, flexDirection: 'row' },
  cells: { flexDirection: 'row' },
  bold: { fontWeight: '700' },
  fill: { flex: 1 },
});
