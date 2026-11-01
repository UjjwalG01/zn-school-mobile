import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/useTheme';
import { Text } from './Text';

/** A row is a line of reading, not a control, but it stays tall enough to tap and scan (UI_SYSTEM §5). */
const ROW_MIN_HEIGHT = 44;

export interface DataTableColumn<Row> {
  key: string;
  title: string;
  /** Right-aligns the column (numbers). Default: start. */
  align?: 'start' | 'end';
  /** Share of the free width. Default 1. */
  flex?: number;
  /** The cell's content: plain `Text`, or a shared primitive such as `StatusBadge`. */
  render: (row: Row) => ReactNode;
}

export interface DataTableProps<Row> {
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  keyExtractor: (row: Row) => string;
  /**
   * The whole row as one sentence for screen readers, e.g. "3 Mar, Present". Without it each cell is read in order.
   * Required when a cell is only an icon or a badge whose words would not make sense alone.
   */
  rowLabel?: (row: Row) => string;
}

/**
 * The one table for read-only lists of rows (UI_SYSTEM §2). A column header on the page background with a hairline under
 * it, then a hairline between rows. Columns share the width; a cell's `Text` sets its own `numberOfLines` if it can run long.
 * Shows no empty or loading state: the caller wraps it in `QueryState`, as every other list does.
 * shortcut: rows are mapped inside the caller's scroll view, fine for one month or one subject (about 31 rows);
 * a list that can grow beyond that moves to `ListScreen` and reuses these styles, upgrade when a list needs it.
 */
export function DataTable<Row>({ columns, rows, keyExtractor, rowLabel }: DataTableProps<Row>) {
  const { colors, spacing } = useTheme();
  return (
    <View>
      <View
        accessibilityRole="header"
        style={[styles.line, { borderBottomColor: colors.border, paddingVertical: spacing.xs, gap: spacing.sm }]}
      >
        {columns.map((column) => (
          <View key={column.key} style={[styles.cell, { flex: column.flex ?? 1, alignItems: alignOf(column) }]}>
            <Text variant="caption" tone="muted" style={styles.bold}>
              {column.title}
            </Text>
          </View>
        ))}
      </View>
      {rows.map((row) => (
        <View
          key={keyExtractor(row)}
          accessible={rowLabel !== undefined}
          accessibilityLabel={rowLabel?.(row)}
          style={[
            styles.line,
            { borderBottomColor: colors.border, minHeight: ROW_MIN_HEIGHT, paddingVertical: spacing.xs, gap: spacing.sm },
          ]}
        >
          {columns.map((column) => (
            <View key={column.key} style={[styles.cell, { flex: column.flex ?? 1, alignItems: alignOf(column) }]}>
              {column.render(row)}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const alignOf = (column: { align?: 'start' | 'end' }) => (column.align === 'end' ? 'flex-end' : 'flex-start');

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  // `minWidth: 0` lets a long value truncate inside its share of the row instead of pushing the other columns out.
  cell: { minWidth: 0, justifyContent: 'center' },
  bold: { fontWeight: '700' },
});
