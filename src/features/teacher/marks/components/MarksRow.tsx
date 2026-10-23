import { memo } from 'react';
import { View } from 'react-native';

import type { ExamResult, ExamRosterRow } from '../../../../api/types/academic';
import type { ExamComponent } from '../../../../api/types/portal';
import { Banner } from '../../../../components/Banner';
import { Button } from '../../../../components/Button';
import { Card } from '../../../../components/Card';
import { Text } from '../../../../components/Text';
import { TextField } from '../../../../components/TextField';
import { t } from '../../../../i18n';
import { useTheme } from '../../../../theme/useTheme';
import { type DraftStudent, formatMarks, studentMarks } from '../marksModel';

export interface MarksRowProps {
  row: ExamRosterRow;
  /** The saved result, if any (carries the version the save is checked against). */
  result: ExamResult | undefined;
  /** The teacher's unsaved edit for this student, if any. */
  entry: DraftStudent | undefined;
  components: readonly ExamComponent[];
  /** The subject was submitted: shown, not editable. */
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
 * One student with one numeric field per component. Memoized and fed stable callbacks, so typing for
 * one student re-renders one row (a class can reach 200 students on a low-end phone).
 */
export const MarksRow = memo(function MarksRow({
  row,
  result,
  entry,
  components,
  readOnly,
  conflict,
  failure,
  onChange,
  onKeepMine,
  onDiscard,
}: MarksRowProps) {
  const { spacing } = useTheme();
  const state = studentMarks(components, entry, result);
  const details = [row.rollNumber ? t('attendance.roll', { number: row.rollNumber }) : null, row.admissionNumber]
    .filter(Boolean)
    .join(' · ');
  // Only when nothing is wrong with a field yet: a field problem already says what to fix.
  const incomplete = state.changed && !state.complete && state.fields.every((field) => field.problem === null);

  return (
    <Card emphasis={conflict ? 'warning' : failure ? 'danger' : undefined}>
      <Text variant="bodyLarge" style={{ fontWeight: '600' }}>
        {row.fullName}
      </Text>
      {details ? (
        <Text variant="caption" tone="muted">
          {details}
        </Text>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {state.fields.map(({ component, text, problem }) => {
          const max = formatMarks(component.maxMarks);
          return (
            <View key={component.id} style={{ flexGrow: 1, flexBasis: 140 }}>
              <TextField
                label={t('marks.field', { name: component.name, max })}
                accessibilityLabel={t('marks.fieldFor', { name: row.fullName, component: component.name, max })}
                value={text}
                keyboardType="decimal-pad"
                editable={!readOnly}
                error={problem ? t(`marks.error.${problem}`, { max }) : null}
                onChangeText={(next) => onChange(row.enrollmentId, result, component.id, next)}
              />
            </View>
          );
        })}
      </View>

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
    </Card>
  );
});
