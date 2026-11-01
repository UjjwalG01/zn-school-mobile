import { memo, useState } from 'react';
import { View } from 'react-native';

import type { AttendanceStatusSetting } from '../../../../api/types/attendance';
import type { ExamAttendanceRow, ExamAttendanceStatus } from '../../../../api/types/examAttendance';
import { Banner } from '../../../../components/Banner';
import { Button } from '../../../../components/Button';
import { Card } from '../../../../components/Card';
import { StatusBadge } from '../../../../components/StatusBadge';
import { Text } from '../../../../components/Text';
import { TextField } from '../../../../components/TextField';
import { t } from '../../../../i18n';
import { useTheme } from '../../../../theme/useTheme';
import { STATUS_TONE } from '../../../../lib/attendanceStatus';
import { StatusPicker } from '../../attendance/components/StatusPicker';
import { type DraftEntry, effectiveEntry } from '../examAttendanceModel';

/** The backend's limit for a remark (`ExamAttendanceItemDto.remarks`). */
const MAX_REMARK_LENGTH = 255;

export interface ExamAttendanceStudentRowProps {
  row: ExamAttendanceRow;
  /** The teacher's unsaved edit for this student, if any. */
  entry: DraftEntry | undefined;
  options: readonly AttendanceStatusSetting[];
  /** The exam is a draft or locked: the roster is shown, nothing can be changed. */
  readOnly: boolean;
  /** The saved record moved on since the teacher edited this student. */
  conflict: boolean;
  /** The backend's reason this student's row was refused, shown as returned. */
  failure: string | undefined;
  onStatus: (row: ExamAttendanceRow, status: ExamAttendanceStatus) => void;
  onRemarks: (row: ExamAttendanceRow, remarks: string) => void;
  onKeepMine: (row: ExamAttendanceRow) => void;
  onDiscard: (enrollmentId: string) => void;
}

/**
 * One student. Memoized and fed stable callbacks, so changing one student re-renders one row (a class can reach 200
 * students on a low-end phone).
 */
export const ExamAttendanceStudentRow = memo(function ExamAttendanceStudentRow({
  row,
  entry,
  options,
  readOnly,
  conflict,
  failure,
  onStatus,
  onRemarks,
  onKeepMine,
  onDiscard,
}: ExamAttendanceStudentRowProps) {
  const { spacing } = useTheme();
  const [remarkOpen, setRemarkOpen] = useState(false);
  const { status, remarks } = effectiveEntry(row, entry);

  const statusText = status ? t(`examAttendance.status.${status}`) : t('examAttendance.notMarked');
  const details = [row.rollNumber ? t('attendance.roll', { number: row.rollNumber }) : null, row.admissionNumber]
    .filter(Boolean)
    .join(' · ');
  // A remark belongs to a status: offered once the student has one.
  const showRemark = status !== null && (remarkOpen || remarks.length > 0);

  return (
    <Card emphasis={conflict ? 'warning' : failure ? 'danger' : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text variant="bodyLarge" style={{ fontWeight: '600' }}>
            {row.fullName}
          </Text>
          {details ? (
            <Text variant="caption" tone="muted">
              {details}
            </Text>
          ) : null}
        </View>
        <StatusBadge label={statusText} tone={status ? STATUS_TONE[status] : 'neutral'} />
      </View>

      <StatusPicker
        options={options}
        selected={status}
        disabled={readOnly}
        accessibilityLabel={t('examAttendance.statusFor', { name: row.fullName })}
        onSelect={(next) => onStatus(row, next as ExamAttendanceStatus)}
      />

      {showRemark ? (
        <TextField
          label={t('attendance.remark')}
          value={remarks}
          maxLength={MAX_REMARK_LENGTH}
          editable={!readOnly}
          onChangeText={(text) => onRemarks(row, text)}
        />
      ) : status !== null && !readOnly ? (
        <Button variant="link" title={t('attendance.addRemark')} onPress={() => setRemarkOpen(true)} />
      ) : null}

      {conflict && entry ? (
        <View style={{ gap: spacing.xs }}>
          <Banner tone="warning">
            {t('attendance.conflict', {
              server: row.record ? t(`examAttendance.status.${row.record.status}`) : t('examAttendance.notMarked'),
              mine: t(`examAttendance.status.${entry.status}`),
            })}
          </Banner>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Button variant="link" title={t('attendance.keepMine')} onPress={() => onKeepMine(row)} />
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
