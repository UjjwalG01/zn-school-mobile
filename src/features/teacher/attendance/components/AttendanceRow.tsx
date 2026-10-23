import Ionicons from '@expo/vector-icons/Ionicons';
import { memo, useState } from 'react';
import { Pressable, View } from 'react-native';

import type {
  AttendanceSettings,
  AttendanceStatus,
  AttendanceStatusSetting,
  RosterRow,
} from '../../../../api/types/attendance';
import { Banner } from '../../../../components/Banner';
import { Button } from '../../../../components/Button';
import { Card } from '../../../../components/Card';
import { StatusBadge } from '../../../../components/StatusBadge';
import { Text } from '../../../../components/Text';
import { TextField } from '../../../../components/TextField';
import { t } from '../../../../i18n';
import { MIN_TOUCH_TARGET } from '../../../../theme/tokens';
import { useTheme } from '../../../../theme/useTheme';
import { type DraftEntry, effectiveEntry, labelFor, STATUS_TONE } from '../attendanceModel';
import { StatusPicker } from './StatusPicker';

/** The backend's limit for a remark (`BulkAttendanceRowDto.remarks`). */
const MAX_REMARK_LENGTH = 255;

export interface AttendanceRowProps {
  row: RosterRow;
  /** The teacher's unsaved edit for this student, if any. */
  entry: DraftEntry | undefined;
  settings: AttendanceSettings;
  options: readonly AttendanceStatusSetting[];
  /** A holiday / weekly off: the roster is shown, nothing can be changed. */
  readOnly: boolean;
  /** The saved record moved on since the teacher edited this student. */
  conflict: boolean;
  /** The backend's reason this student's row was refused, shown as returned. */
  failure: string | undefined;
  onStatus: (row: RosterRow, status: AttendanceStatus) => void;
  onRemarks: (row: RosterRow, remarks: string) => void;
  onKeepMine: (row: RosterRow) => void;
  onDiscard: (studentId: string) => void;
  /** Opens the student's details; left out when the school or the teacher's role does not allow it. */
  onOpenStudent?: (studentId: string) => void;
}

/**
 * One student. Memoized and fed stable callbacks, so changing one student re-renders one row
 * (rosters can reach 200 students on low-end phones).
 */
export const AttendanceRow = memo(function AttendanceRow({
  row,
  entry,
  settings,
  options,
  readOnly,
  conflict,
  failure,
  onStatus,
  onRemarks,
  onKeepMine,
  onDiscard,
  onOpenStudent,
}: AttendanceRowProps) {
  const { colors, spacing } = useTheme();
  const [remarkOpen, setRemarkOpen] = useState(false);
  const { status, remarks } = effectiveEntry(row, entry);

  const statusText = status ? labelFor(settings, status) : t('attendance.notMarked');
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <StatusBadge label={statusText} tone={status ? STATUS_TONE[status] : 'neutral'} />
          {onOpenStudent ? (
            // Beside the badge, not on the row, so it never competes with the status picker below.
            <Pressable
              onPress={() => onOpenStudent(row.studentId)}
              accessibilityRole="button"
              accessibilityLabel={t('studentInfo.open', { name: row.fullName })}
              style={{ minWidth: MIN_TOUCH_TARGET, minHeight: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="information-circle-outline" size={24} color={colors.accent} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <StatusPicker
        options={options}
        selected={status}
        disabled={readOnly}
        accessibilityLabel={t('attendance.statusFor', { name: row.fullName })}
        onSelect={(next) => onStatus(row, next)}
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
              server: row.record ? labelFor(settings, row.record.status) : t('attendance.notMarked'),
              mine: labelFor(settings, entry.status),
            })}
          </Banner>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Button variant="link" title={t('attendance.keepMine')} onPress={() => onKeepMine(row)} />
            <Button variant="link" title={t('attendance.useTheirs')} onPress={() => onDiscard(row.studentId)} />
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
