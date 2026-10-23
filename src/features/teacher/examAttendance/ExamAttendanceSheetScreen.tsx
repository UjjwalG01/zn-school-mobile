// Who sat one paper (docs/project/CALENDAR_AND_EXAM_ATTENDANCE_PLAN.md). The app shows what the backend returned and sends
// what the teacher changed; which students the teacher may record, whether the exam is open and whether the paper's day has
// come are all the server's decisions, answered per request. The draft lives in memory only.
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import type { ExamAttendanceRow } from '../../../api/types/examAttendance';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { ListScreen } from '../../../components/ListScreen';
import { OfflineBanner, savedDataTimestamp } from '../../../components/OfflineBanner';
import { QueryState, queryView } from '../../../components/QueryState';
import { Screen } from '../../../components/Screen';
import { Text } from '../../../components/Text';
import { t } from '../../../i18n';
import { formatDate } from '../../../lib/date';
import { showToast } from '../../../lib/toast';
import { useTheme } from '../../../theme/useTheme';
import { useRefreshSchoolsOnFeatureDenied } from '../../featureDenied';
import { useTenantSettings } from '../../queries';
import { useManualRefresh } from '../../useManualRefresh';
import { useUnsavedGuard } from '../../useUnsavedGuard';
import { ExamAttendanceStudentRow } from './components/ExamAttendanceStudentRow';
import {
  canMarkRemainingPresent,
  changedCount,
  conflictIds,
  MAX_SAVE_ROWS,
  statusOptions,
  summaryText,
} from './examAttendanceModel';
import { useExamAttendanceRoster } from './queries';
import { useExamAttendanceDraft } from './useExamAttendanceDraft';
import { type SubmitOutcome, useSubmitExamAttendance } from './useSubmitExamAttendance';

const NO_ROWS: readonly ExamAttendanceRow[] = [];

const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

interface Notice {
  tone: 'info' | 'warning';
  text: string;
}

/** The note shown above Save after a save that did not go through; null = nothing to say. */
function noticeFor(outcome: Exclude<SubmitOutcome, { kind: 'ignored' | 'saved' }>): Notice | null {
  if (outcome.kind === 'refused') return { tone: 'warning', text: t('attendance.refused') };
  const warn = (text: string): Notice => ({ tone: 'warning', text });
  switch (outcome.action) {
    case 'offline':
      return warn(t('attendance.offlineKept'));
    case 'conflict':
      return warn(t('attendance.conflictRetry'));
    case 'forbidden':
      return warn(t('examAttendance.forbidden'));
    case 'validation': // a draft or locked exam, a paper not held yet: the backend's own words
    case 'wait':
      return warn(outcome.message || t('attendance.saveFailed'));
    case 'session-expired':
    case 'drop-school':
    case 'school-suspended':
    case 'license-blocked':
      return null; // the session layer already takes over
    default:
      return warn(t('attendance.saveFailed'));
  }
}

export default function ExamAttendanceSheetScreen() {
  const params = useLocalSearchParams<{
    examId?: string;
    examSubjectId?: string;
    sectionId?: string;
    sectionName?: string;
  }>();
  const examId = single(params.examId);
  const examSubjectId = single(params.examSubjectId);
  const sectionId = single(params.sectionId) ?? null;
  const sectionName = single(params.sectionName);

  const { spacing } = useTheme();
  const target = { examId: examId ?? '', examSubjectId: examSubjectId ?? '', sectionId };
  const roster = useExamAttendanceRoster(examId && examSubjectId ? target : null);
  const calendar = useTenantSettings().data?.calendarPreference;
  const { draft, reset, setStatus, setRemarks, markRemaining, keepMine, discard } = useExamAttendanceDraft();
  const { submit, isPending } = useSubmitExamAttendance(target);
  const [failures, setFailures] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  useRefreshSchoolsOnFeatureDenied(roster.error);
  const { refreshing, onRefresh } = useManualRefresh(() => roster.refetch());

  const rows = roster.data?.rows ?? NO_ROWS;
  const changed = changedCount(rows, draft);
  useUnsavedGuard(changed > 0, t('examAttendance.discardBody'));

  const options = useMemo(() => statusOptions(), []);
  const conflicts = useMemo(() => new Set(conflictIds(rows, draft)), [rows, draft]);
  // No sections at all when there are no students: SectionList shows ListEmptyComponent only then.
  const sections = useMemo(() => (rows.length > 0 ? [{ data: rows }] : []), [rows]);

  const title = (
    <Stack.Screen options={{ title: roster.data?.examSubject.subjectName ?? t('examAttendance.title') }} />
  );

  if (!examId || !examSubjectId) {
    return (
      <>
        {title}
        <Screen>
          <Text tone="muted">{t('examAttendance.notFound')}</Text>
        </Screen>
      </>
    );
  }

  if (queryView(roster) !== 'content' || !roster.data) {
    return (
      <>
        {title}
        <Screen refreshing={refreshing} onRefresh={onRefresh}>
          <QueryState query={roster}>{null}</QueryState>
        </Screen>
      </>
    );
  }

  const { exam, examSubject, editable } = roster.data;
  const readOnly = !editable;
  const savedFrom = savedDataTimestamp([roster]);
  const canSave = !readOnly && changed > 0 && changed <= MAX_SAVE_ROWS && conflicts.size === 0 && !isPending;
  const hint = readOnly
    ? null
    : conflicts.size > 0
      ? t('attendance.resolveFirst')
      : changed === 0
        ? t('attendance.noChanges')
        : changed > MAX_SAVE_ROWS
          ? t('attendance.tooMany', { max: MAX_SAVE_ROWS })
          : null;
  const context = [
    exam.name,
    examSubject.examDate && calendar ? formatDate(examSubject.examDate, calendar) : (examSubject.examDate ?? t('examAttendance.noDate')),
    sectionId && sectionName ? t('examAttendance.section', { name: sectionName }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  async function onSave() {
    setNotice(null);
    setFailures({});
    const outcome = await submit(rows, draft);
    if (outcome.kind === 'ignored') return;
    if (outcome.kind === 'saved') {
      reset();
      showToast(t('examAttendance.saved'), 'success');
      return;
    }
    if (outcome.kind === 'refused') setFailures(outcome.failures);
    setNotice(noticeFor(outcome));
  }

  return (
    <>
      {title}
      <ListScreen
        sections={sections}
        keyExtractor={(row) => row.enrollmentId}
        extraData={{ draft, failures, readOnly }}
        refreshing={refreshing}
        onRefresh={onRefresh}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        windowSize={7}
        ListHeaderComponent={
          <View style={{ gap: spacing.md }}>
            <Text variant="body" tone="muted">
              {context}
            </Text>
            <OfflineBanner asOf={savedFrom} />
            {readOnly ? <Banner tone="warning">{t('examAttendance.closed')}</Banner> : null}
            {rows.length > 0 ? <Text variant="body">{summaryText(rows, draft)}</Text> : null}
            {!readOnly && canMarkRemainingPresent(rows, draft) ? (
              <Button title={t('attendance.markRemaining')} onPress={() => markRemaining(rows)} />
            ) : null}
          </View>
        }
        ListEmptyComponent={<Text tone="muted">{t('examAttendance.empty')}</Text>}
        renderItem={({ item }) => (
          <ExamAttendanceStudentRow
            row={item}
            entry={draft[item.enrollmentId]}
            options={options}
            readOnly={readOnly}
            conflict={conflicts.has(item.enrollmentId)}
            failure={failures[item.enrollmentId]}
            onStatus={setStatus}
            onRemarks={setRemarks}
            onKeepMine={keepMine}
            onDiscard={discard}
          />
        )}
        footer={
          readOnly ? undefined : (
            <>
              {notice ? <Banner tone={notice.tone}>{notice.text}</Banner> : null}
              {hint ? (
                <Text variant="caption" tone="muted">
                  {hint}
                </Text>
              ) : null}
              <Button
                title={t('attendance.save', { count: changed })}
                loading={isPending}
                disabled={!canSave}
                onPress={() => void onSave()}
              />
            </>
          )
        }
      />
    </>
  );
}
