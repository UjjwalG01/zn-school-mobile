import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ExamResult, ExamRosterRow } from '../../../../api/types/academic';
import { Banner } from '../../../../components/Banner';
import { Button } from '../../../../components/Button';
import { Text } from '../../../../components/Text';
import { t } from '../../../../i18n';
import { useTheme } from '../../../../theme/useTheme';
import { type DraftStudent, formatMarks, type MarkColumn, studentMarks } from '../marksModel';
import { ID_MIN_WIDTH, MarkCell, ROLL_WIDTH } from './MarkCell';

/** The emphasis stripe at the start of a row that needs attention. */
const STRIPE = 3;

export interface MarksRowProps {
  row: ExamRosterRow;
  /** The saved result, if any (carries the version the save is checked against). */
  result: ExamResult | undefined;
  /** The teacher's unsaved edit for this student, if any. */
  entry: DraftStudent | undefined;
  columns: readonly MarkColumn[];
  cellWidth: number;
  /** The subject was submitted, or a save is in flight: shown, not editable. */
  readOnly: boolean;
  /** The saved result moved on since the teacher edited this student. */
  conflict: boolean;
  /** The backend's reason this student was refused, shown as returned. */
  failure: string | undefined;
  onChange: (enrollmentId: string, result: ExamResult | undefined, componentId: string, text: string) => void;
  onKeepMine: (enrollmentId: string, result: ExamResult | undefined) => void;
  onDiscard: (enrollmentId: string) => void;
}

/**
 * One student on one line: roll number, name, and a box per column. Memoized and fed stable callbacks, so typing for one
 * student re-renders one row (a class can reach 200 students on a low-end phone). What needs saying about a student (a
 * mark out of range, a missing mark, a conflict, a refusal) is added under the line, so a clean row stays one line.
 */
export const MarksRow = memo(function MarksRow({
  row,
  result,
  entry,
  columns,
  cellWidth,
  readOnly,
  conflict,
  failure,
  onChange,
  onKeepMine,
  onDiscard,
}: MarksRowProps) {
  const { colors, spacing } = useTheme();
  const components = columns.flatMap((column) => (column.component ? [column.component] : []));
  const state = studentMarks(components, entry, result);
  const fieldOf = new Map(state.fields.map((field) => [field.component.id, field]));
  const problems = columns.flatMap((column) => {
    const field = column.component ? fieldOf.get(column.component.id) : undefined;
    return field?.problem && column.component ? [{ column, problem: field.problem, max: formatMarks(column.component.maxMarks) }] : [];
  });
  // Only when nothing is wrong with a field yet: a field problem already says what to fix.
  const incomplete = state.changed && !state.complete && problems.length === 0;
  const stripe = conflict ? colors.warning : failure ? colors.destructive : colors.bg;

  return (
    <View
      style={[
        styles.item,
        { borderBottomColor: colors.border, borderStartColor: stripe, paddingVertical: spacing.xs, gap: spacing.xs },
      ]}
    >
      <View style={[styles.line, { columnGap: spacing.sm, rowGap: spacing.xs }]}>
        <View style={[styles.id, { minWidth: ID_MIN_WIDTH }]}>
          <Text variant="caption" tone="muted" style={{ width: ROLL_WIDTH }}>
            {row.rollNumber ?? '–'}
          </Text>
          <Text style={styles.name} numberOfLines={2}>
            {row.fullName}
          </Text>
        </View>
        <View style={[styles.cells, { gap: spacing.xs }]}>
          {columns.map((column) => {
            const field = column.component ? fieldOf.get(column.component.id) : undefined;
            const max = column.component ? formatMarks(column.component.maxMarks) : '';
            return (
              <MarkCell
                key={column.key}
                width={cellWidth}
                text={field?.text ?? ''}
                applicable={column.component !== null}
                editable={!readOnly}
                invalid={Boolean(field?.problem)}
                accessibilityLabel={
                  column.component
                    ? t('marks.fieldFor', { name: row.fullName, component: column.component.name, max })
                    : t('marks.notApplicable', { name: row.fullName, component: column.title })
                }
                onChangeText={(text) => column.component && onChange(row.enrollmentId, result, column.component.id, text)}
              />
            );
          })}
        </View>
      </View>

      {problems.map(({ column, problem, max }) => (
        <View key={column.key} style={[styles.note, { gap: spacing.xs }]}>
          <Text variant="caption" tone="error" style={styles.bold}>
            {column.title}
          </Text>
          <Text variant="caption" tone="error" accessibilityLiveRegion="polite">
            {t(`marks.error.${problem}`, { max })}
          </Text>
        </View>
      ))}

      {incomplete ? (
        <Text variant="caption" tone="muted">
          {t('marks.incomplete')}
        </Text>
      ) : null}

      {conflict && entry ? (
        <View style={{ gap: spacing.xs }}>
          <Banner tone="warning">{t('marks.conflict')}</Banner>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Button variant="link" title={t('attendance.keepMine')} onPress={() => onKeepMine(row.enrollmentId, result)} />
            <Button variant="link" title={t('attendance.useTheirs')} onPress={() => onDiscard(row.enrollmentId)} />
          </View>
        </View>
      ) : failure ? (
        <Text variant="caption" tone="error" accessibilityLiveRegion="polite">
          {failure}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  item: { borderBottomWidth: StyleSheet.hairlineWidth, borderStartWidth: STRIPE },
  line: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  id: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  name: { flex: 1, fontWeight: '600' },
  cells: { flexDirection: 'row' },
  note: { flexDirection: 'row' },
  bold: { fontWeight: '700' },
});
