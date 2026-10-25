// Enter, save and submit the marks of ONE subject in ONE section (docs/project/MARKS_PLAN.md §5).
// The app shows what the backend returned and sends what the teacher typed; it decides nothing about
// eligibility, grading or scope. Unsaved edits live in memory only (M-D2); every save sends the result
// version the teacher saw (M-D1); Submit asks first (M-D3).
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';

import type { ExamComponent } from '../../../api/types/portal';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { ListScreen } from '../../../components/ListScreen';
import { OfflineBanner, savedDataTimestamp } from '../../../components/OfflineBanner';
import { QueryState, queryView } from '../../../components/QueryState';
import { Screen } from '../../../components/Screen';
import { StatusBadge } from '../../../components/StatusBadge';
import { Text } from '../../../components/Text';
import { t } from '../../../i18n';
import { showToast } from '../../../lib/toast';
import { useTheme } from '../../../theme/useTheme';
import { useRefreshSchoolsOnFeatureDenied } from '../../featureDenied';
import { useManualRefresh } from '../../useManualRefresh';
import { useUnsavedGuard } from '../../useUnsavedGuard';
import { placementLabel } from '../placement';
import { useTeacherExams } from '../queries';
import { cellWidthFor } from './components/MarkCell';
import { MarksRow } from './components/MarksRow';
import { MarksTableHeader } from './components/MarksTableHeader';
import {
  buildItems,
  changedCount,
  completeCount,
  conflictIds,
  findSlot,
  indexResults,
  MAX_BULK_ITEMS,
  markColumns,
  type SlotRef,
  saveCounts,
  sortRoster,
} from './marksModel';
import { useExamResults, useExamRoster } from './queries';
import { useMarksDraft } from './useMarksDraft';
import { type SaveOutcome, type SubmitOutcome, useSaveMarks, useSubmitSubject } from './useSubmitMarks';

const NO_COMPONENTS: readonly ExamComponent[] = [];

const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

interface Notice {
  tone: 'info' | 'warning';
  text: string;
}

/** The note shown above the buttons after a save or submit that did not go through; null = nothing to say. */
function noticeFor(
  outcome: Exclude<SaveOutcome | SubmitOutcome, { kind: 'ignored' | 'saved' | 'submitted' }>,
  operation: 'save' | 'submit',
): Notice | null {
  const warn = (text: string): Notice => ({ tone: 'warning', text });
  if (outcome.kind === 'refused') return warn(t('attendance.refused'));
  if (outcome.code === 'EXAM_MARKS_SUBMITTED') return warn(t('marks.alreadySubmitted'));
  if (outcome.code === 'EXAM_MARKS_INCOMPLETE') return warn(t('marks.submitIncomplete'));
  switch (outcome.action) {
    case 'offline':
      return warn(t('attendance.offlineKept'));
    case 'conflict': // a submit conflict has no highlighted students: the submission itself moved on
      return warn(t(operation === 'submit' ? 'marks.submitConflict' : 'marks.conflictRetry'));
    case 'forbidden':
      return warn(t('marks.forbidden'));
    case 'validation': // the marks gate or a refused value: the backend's own words
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

/**
 * Memoized by hand (the React Compiler is not on in this build): a new array each render would re-render every memoized row on
 * every key. A hook of its own so nothing else in the screen's body makes the lint think `components` may change.
 */
function useMarkColumns(components: readonly ExamComponent[]) {
  return useMemo(() => markColumns(components, (type) => t(`marks.type.${type}`)), [components]);
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text style={{ fontWeight: '600' }}>{value}</Text>
    </View>
  );
}

export default function MarksEntryScreen() {
  const params = useLocalSearchParams<{ examId?: string; examSubjectId?: string; sectionId?: string }>();
  const examId = single(params.examId) ?? '';
  const examSubjectId = single(params.examSubjectId) ?? '';
  const slotRef: SlotRef = { examId, examSubjectId, sectionId: single(params.sectionId) ?? null };

  const { colors, spacing } = useTheme();
  const exams = useTeacherExams();
  const slot = exams.data && examId && examSubjectId ? findSlot(exams.data, slotRef) : null;
  const roster = useExamRoster(slot ? { examId, sectionId: slotRef.sectionId } : null);
  const results = useExamResults(slot ? examId : null);
  const { draft, setValue, keepMine, drop, reset } = useMarksDraft();
  const { save, isPending: saving } = useSaveMarks(examId);
  const { submit, isPending: submitting } = useSubmitSubject(slotRef);
  const [failures, setFailures] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  useRefreshSchoolsOnFeatureDenied(exams.error, roster.error, results.error);
  const { refreshing, onRefresh } = useManualRefresh(() =>
    Promise.all([exams.refetch(), roster.refetch(), results.refetch()]),
  );

  const rows = useMemo(() => sortRoster(roster.data ?? []), [roster.data]);
  const byEnrollment = useMemo(() => indexResults(results.data ?? []), [results.data]);
  const components = slot?.subject.components ?? NO_COMPONENTS;
  const columns = useMarkColumns(components);
  const changed = changedCount(rows, byEnrollment, draft);
  useUnsavedGuard(changed > 0, t('marks.discardBody'));

  const conflicts = useMemo(() => new Set(conflictIds(rows, byEnrollment, draft)), [rows, byEnrollment, draft]);
  const items = buildItems(rows, byEnrollment, components, draft);
  // No sections at all when there are no students: SectionList shows ListEmptyComponent only then.
  const sections = useMemo(() => (rows.length > 0 ? [{ data: rows }] : []), [rows]);
  const discard = useCallback((enrollmentId: string) => drop([enrollmentId]), [drop]);

  const title = <Stack.Screen options={{ title: slot?.subject.subjectName ?? t('academic.marks') }} />;

  // The exam list answered but this subject is not in it: the exam closed, or the link is old.
  if (!examId || !examSubjectId || (exams.data !== undefined && !slot)) {
    return (
      <>
        {title}
        <Screen>
          <Text tone="muted">{t('marks.notFound')}</Text>
        </Screen>
      </>
    );
  }

  // The exam list, the students and the saved marks are all needed before anything can be entered.
  const waiting = [exams, roster, results].find((query) => queryView(query) !== 'content');
  if (waiting || !slot || !roster.data || !results.data) {
    return (
      <>
        {title}
        <Screen refreshing={refreshing} onRefresh={onRefresh}>
          <QueryState query={waiting ?? exams}>{null}</QueryState>
        </Screen>
      </>
    );
  }

  const { exam, subject } = slot;
  const submission = subject.submission;
  const readOnly = submission?.status === 'submitted';
  const { ready, incomplete } = saveCounts(rows, byEnrollment, components, draft);
  const complete = completeCount(rows, byEnrollment, components, draft);
  const savedFrom = savedDataTimestamp([exams, roster, results]);

  const busy = saving || submitting;
  const cellWidth = cellWidthFor(columns.length);
  const canSave = !readOnly && ready > 0 && ready <= MAX_BULK_ITEMS && conflicts.size === 0 && !busy;
  // `exams.isFetching`: a save opens the backend's draft row, and Submit must send the version it now has.
  const canSubmit =
    !readOnly && rows.length > 0 && changed === 0 && complete === rows.length && !exams.isFetching && !busy;
  const hint =
    conflicts.size > 0
      ? t('attendance.resolveFirst')
      : ready > MAX_BULK_ITEMS
        ? t('attendance.tooMany', { max: MAX_BULK_ITEMS })
        : incomplete > 0
          ? t('marks.incompleteHint')
          : changed > 0
            ? t('marks.saveFirst')
            : complete < rows.length
              ? t('marks.submitNeedsAll')
              : t('marks.noChanges');

  async function onSave() {
    setNotice(null);
    setFailures({});
    const outcome = await save(items);
    if (outcome.kind === 'ignored') return;
    if (outcome.kind === 'saved') {
      drop(outcome.savedIds);
      showToast(t('marks.saved'), 'success');
      return;
    }
    if (outcome.kind === 'refused') setFailures(outcome.failures);
    setNotice(noticeFor(outcome, 'save'));
  }

  async function onConfirmSubmit() {
    setNotice(null);
    const outcome = await submit(submission?.version ?? 0);
    if (outcome.kind === 'ignored') return;
    if (outcome.kind === 'submitted') {
      reset();
      showToast(t('marks.submitted'), 'success');
      return;
    }
    setNotice(noticeFor(outcome, 'submit'));
  }

  const onSubmit = () =>
    Alert.alert(t('marks.submitConfirmTitle'), t('marks.submitConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('marks.submit'), onPress: () => void onConfirmSubmit() },
    ]);

  return (
    <>
      {title}
      <ListScreen
        sections={sections}
        keyExtractor={(row) => row.enrollmentId}
        extraData={{ draft, failures, readOnly, busy, byEnrollment, conflicts, columns }}
        refreshing={refreshing}
        onRefresh={onRefresh}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        windowSize={5}
        stickySectionHeadersEnabled
        renderSectionHeader={() => <MarksTableHeader columns={columns} cellWidth={cellWidth} />}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, paddingBottom: spacing.sm }}>
            {/* Exam, class and subject once, here, instead of in every student row. */}
            <Card tint={colors.accent}>
              <Text variant="caption" tone="muted">
                {t('marks.header.exam')}
              </Text>
              <Text variant="title" accessibilityRole="header">
                {exam.name}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, rowGap: spacing.xs }}>
                <Fact
                  label={t('marks.header.class')}
                  value={placementLabel({ className: exam.className, sectionName: subject.sectionName })}
                />
                <Fact label={t('marks.header.subject')} value={subject.subjectName} />
                <Fact label={t('marks.header.session')} value={exam.sessionName} />
              </View>
            </Card>
            <OfflineBanner asOf={savedFrom} />
            {submission?.status === 'returned' ? (
              <Banner tone="warning">
                {submission.returnedReason
                  ? t('marks.returnedBanner', { reason: submission.returnedReason })
                  : t('home.progress.returned')}
              </Banner>
            ) : null}
            {readOnly ? <Banner tone="info">{t('marks.submittedBanner')}</Banner> : null}
            {rows.length > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
                <Text>{t('marks.summary', { complete, total: rows.length })}</Text>
                {changed > 0 ? <StatusBadge tone="warning" label={t('marks.unsaved', { count: changed })} /> : null}
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={<Text tone="muted">{t('marks.noStudents')}</Text>}
        renderItem={({ item }) => (
          <MarksRow
            row={item}
            result={byEnrollment.get(item.enrollmentId)}
            entry={draft[item.enrollmentId]}
            columns={columns}
            cellWidth={cellWidth}
            readOnly={readOnly || busy}
            conflict={conflicts.has(item.enrollmentId)}
            failure={failures[item.enrollmentId]}
            onChange={setValue}
            onKeepMine={keepMine}
            onDiscard={discard}
          />
        )}
        footer={
          readOnly ? undefined : (
            <>
              {notice ? <Banner tone={notice.tone}>{notice.text}</Banner> : null}
              <Text variant="caption" tone="muted">
                {hint}
              </Text>
              <Button
                title={t('marks.save', { count: ready })}
                loading={saving}
                disabled={!canSave}
                onPress={() => void onSave()}
              />
              <Button variant="link" title={t('marks.submit')} loading={submitting} disabled={!canSubmit} onPress={onSubmit} />
            </>
          )
        }
      />
    </>
  );
}
