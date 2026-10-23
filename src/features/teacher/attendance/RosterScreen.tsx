// Roster and marking for one class/section on one date (docs/project/ATTENDANCE_PLAN.md §3.8).
// The app shows what the backend returned and sends what the teacher changed; it decides nothing
// about eligibility. The draft lives in memory only.
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';

import type { RosterQuery } from '../../../api/attendance';
import type { RosterRow } from '../../../api/types/attendance';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { DateStepper } from '../../../components/DateStepper';
import { ListScreen } from '../../../components/ListScreen';
import { OfflineBanner, savedDataTimestamp } from '../../../components/OfflineBanner';
import { QueryState, queryView } from '../../../components/QueryState';
import { Screen } from '../../../components/Screen';
import { Text } from '../../../components/Text';
import { t } from '../../../i18n';
import { isIsoDate, todayIso } from '../../../lib/date';
import { showToast } from '../../../lib/toast';
import { useTheme } from '../../../theme/useTheme';
import { useRefreshSchoolsOnFeatureDenied } from '../../featureDenied';
import { useTenantSettings } from '../../queries';
import { useManualRefresh } from '../../useManualRefresh';
import { useUnsavedGuard } from '../../useUnsavedGuard';
import { placementLabel } from '../placement';
import { useTeacherMyClasses } from '../queries';
import { studentHref } from '../students/routes';
import { useCanOpenStudent } from '../students/useCanOpenStudent';
import {
  canMarkRemainingPresent,
  changedCount,
  conflictIds,
  dateBounds,
  MAX_BULK_ROWS,
  statusOptions,
  summarize,
  summaryText,
} from './attendanceModel';
import { AttendanceRow } from './components/AttendanceRow';
import { dayOffText } from './dayOffText';
import { useAttendanceRoster, useAttendanceSettings } from './queries';
import { type SubmitOutcome, useSubmitAttendance } from './useSubmitAttendance';
import { useAttendanceDraft } from './useAttendanceDraft';

const NO_ROWS: readonly RosterRow[] = [];

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
      return warn(t('attendance.forbidden'));
    case 'validation': // the date rule, a holiday, a missing reason: the backend's own words
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

export default function RosterScreen() {
  const params = useLocalSearchParams<{ classId?: string; sectionId?: string; date?: string }>();
  const classId = single(params.classId);
  const sectionId = single(params.sectionId) ?? null;
  const dateParam = single(params.date);

  const { spacing } = useTheme();
  const router = useRouter();
  // "Student details" is offered per row only when the school and the teacher's role allow it (SI-D1, SI-D4).
  const canOpenStudent = useCanOpenStudent();
  const openStudent = useCallback((studentId: string) => router.push(studentHref(studentId)), [router]);
  const [date, setDate] = useState(() => (dateParam && isIsoDate(dateParam) ? dateParam : todayIso()));
  const target: RosterQuery = { date, classId: classId ?? '', sectionId };

  const roster = useAttendanceRoster(classId ? target : null);
  const settings = useAttendanceSettings();
  const myClasses = useTeacherMyClasses(todayIso());
  const calendar = useTenantSettings().data?.calendarPreference;
  const { draft, reset, setStatus, setRemarks, markRemaining, keepMine, discard } = useAttendanceDraft();
  const { submit, isPending } = useSubmitAttendance(target);
  const [failures, setFailures] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  useRefreshSchoolsOnFeatureDenied(roster.error, settings.error);
  const { refreshing, onRefresh } = useManualRefresh(() => Promise.all([roster.refetch(), settings.refetch()]));

  const rows = roster.data?.rows ?? NO_ROWS;
  const changed = changedCount(rows, draft);
  useUnsavedGuard(changed > 0, t('attendance.discardBody'));

  const options = useMemo(() => (settings.data ? statusOptions(settings.data) : []), [settings.data]);
  const conflicts = useMemo(() => new Set(conflictIds(rows, draft)), [rows, draft]);
  // No sections at all when there are no students: SectionList shows ListEmptyComponent only then.
  const sections = useMemo(() => (rows.length > 0 ? [{ data: rows }] : []), [rows]);

  const placement = myClasses.data?.classes.find(
    (candidate) => candidate.classId === classId && (candidate.sectionId ?? null) === sectionId,
  );
  const title = <Stack.Screen options={{ title: placement ? placementLabel(placement) : t('attendance.title') }} />;

  if (!classId) {
    return (
      <>
        {title}
        <Screen>
          <Text tone="muted">{t('attendance.notFound')}</Text>
        </Screen>
      </>
    );
  }

  // Both the roster and the school's status labels are needed before anything can be marked.
  const waiting = [roster, settings].find((query) => queryView(query) !== 'content');
  if (waiting || !roster.data || !settings.data) {
    return (
      <>
        {title}
        <Screen refreshing={refreshing} onRefresh={onRefresh}>
          <QueryState query={waiting ?? roster}>{null}</QueryState>
        </Screen>
      </>
    );
  }

  const { dayInfo } = roster.data;
  const readOnly = !dayInfo.schoolDay;
  const bounds = dateBounds(todayIso(), settings.data);
  const savedFrom = savedDataTimestamp([roster, settings]);
  const summary = summaryText(settings.data, summarize(rows, draft), t('attendance.notMarked'));

  const canSave = !readOnly && changed > 0 && changed <= MAX_BULK_ROWS && conflicts.size === 0 && !isPending;
  const hint = readOnly
    ? null
    : conflicts.size > 0
      ? t('attendance.resolveFirst')
      : changed === 0
        ? t('attendance.noChanges')
        : changed > MAX_BULK_ROWS
          ? t('attendance.tooMany', { max: MAX_BULK_ROWS })
          : null;

  const applyDate = (next: string) => {
    setDate(next);
    reset();
    setFailures({});
    setNotice(null);
  };
  const onChangeDate = (next: string) => {
    if (changed === 0) return applyDate(next);
    Alert.alert(t('attendance.discardTitle'), t('attendance.discardBody'), [
      { text: t('attendance.keepEditing'), style: 'cancel' },
      { text: t('attendance.discard'), style: 'destructive', onPress: () => applyDate(next) },
    ]);
  };

  async function onSave() {
    setNotice(null);
    setFailures({});
    const outcome = await submit(rows, draft);
    if (outcome.kind === 'ignored') return;
    if (outcome.kind === 'saved') {
      reset();
      showToast(t('attendance.saved'), 'success');
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
        keyExtractor={(row) => row.studentId}
        extraData={{ draft, failures, readOnly, canOpenStudent }}
        refreshing={refreshing}
        onRefresh={onRefresh}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        windowSize={7}
        ListHeaderComponent={
          <View style={{ gap: spacing.md }}>
            <DateStepper
              value={date}
              min={bounds.min}
              max={bounds.max}
              calendar={calendar}
              onChange={onChangeDate}
            />
            <OfflineBanner asOf={savedFrom} />
            {readOnly ? <Banner tone="warning">{dayOffText(dayInfo)}</Banner> : null}
            {rows.length > 0 ? <Text variant="body">{summary}</Text> : null}
            {!readOnly && canMarkRemainingPresent(settings.data, rows, draft) ? (
              <Button title={t('attendance.markRemaining')} onPress={() => markRemaining(rows)} />
            ) : null}
          </View>
        }
        ListEmptyComponent={<Text tone="muted">{t('attendance.empty')}</Text>}
        renderItem={({ item }) => (
          <AttendanceRow
            row={item}
            entry={draft[item.studentId]}
            settings={settings.data!}
            options={options}
            readOnly={readOnly}
            conflict={conflicts.has(item.studentId)}
            failure={failures[item.studentId]}
            onStatus={setStatus}
            onRemarks={setRemarks}
            onKeepMine={keepMine}
            onDiscard={discard}
            onOpenStudent={canOpenStudent ? openStudent : undefined}
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
