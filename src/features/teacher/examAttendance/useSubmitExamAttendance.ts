// The one save (docs/project/CALENDAR_AND_EXAM_ATTENDANCE_PLAN.md). Nothing here retries a PUT: the only retry is the
// teacher pressing Save again. The idempotency key follows the payload: the same bytes keep the key (so a request that may
// have reached the server is replayed, not duplicated), any edit gets a new one.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { ApiError, type ApiErrorAction, errorActionOf } from '../../../api/errors';
import { type ExamAttendanceRosterQuery, putExamAttendance } from '../../../api/examAttendance';
import { tenantKey } from '../../../api/queryKeys';
import type { ExamAttendanceRoster, ExamAttendanceRow, ExamAttendanceSaveRequest } from '../../../api/types/examAttendance';
import { myPermissionsKey, mySchoolsKey } from '../../../auth/queries';
import { useSession } from '../../../auth/session';
import { newUuid } from '../../../lib/uuid';
import {
  applySaved,
  attemptFor,
  buildSaveRows,
  type Draft,
  failuresByEnrollment,
  keepKeyAfter,
  MAX_SAVE_ROWS,
  type PendingAttempt,
  payloadSignature,
} from './examAttendanceModel';
import { examAttendanceExamsKey, examAttendanceRosterKey } from './queries';

export type SubmitOutcome =
  /** Nothing sent: a save is already running, or there is nothing (or too much) to send. */
  | { kind: 'ignored' }
  | { kind: 'saved'; replayed: boolean }
  /** 2xx `ok:false`: nothing was written; `failures` is enrollmentId → the backend's reason. */
  | { kind: 'refused'; failures: Record<string, string> }
  | { kind: 'error'; action: ApiErrorAction; message: string };

export function useSubmitExamAttendance(target: ExamAttendanceRosterQuery) {
  const queryClient = useQueryClient();
  const { tenantId } = useSession();
  const attempt = useRef<PendingAttempt | null>(null);
  // `isPending` only flips on the next render; this closes the gap between two quick taps.
  const inFlight = useRef(false);
  // Wrapped so TanStack's second (context) argument never reaches the request function.
  const mutation = useMutation({
    mutationFn: (body: ExamAttendanceSaveRequest) => putExamAttendance(target.examId, body),
  });

  async function submit(rows: readonly ExamAttendanceRow[], draft: Draft): Promise<SubmitOutcome> {
    const records = buildSaveRows(rows, draft);
    if (inFlight.current || records.length === 0 || records.length > MAX_SAVE_ROWS) return { kind: 'ignored' };

    const payload: Omit<ExamAttendanceSaveRequest, 'idempotencyKey'> = {
      examSubjectId: target.examSubjectId,
      records,
    };
    attempt.current = attemptFor(payloadSignature(payload), attempt.current, newUuid);

    inFlight.current = true;
    try {
      const result = await mutation.mutateAsync({ ...payload, idempotencyKey: attempt.current.key });
      attempt.current = null; // answered (saved or refused): the key is spent

      if (result.ok) {
        // Use the write response instead of a refetch (api-and-data §7); only this roster key changes.
        queryClient.setQueryData<ExamAttendanceRoster>(examAttendanceRosterKey(tenantId, target), (roster) =>
          roster ? applySaved(roster, draft, result.results) : roster,
        );
        return { kind: 'saved', replayed: result.replayed };
      }

      // Nothing was written. Fresh versions explain any conflict.
      void queryClient.invalidateQueries({ queryKey: examAttendanceRosterKey(tenantId, target) });
      return { kind: 'refused', failures: failuresByEnrollment(result.failures) };
    } catch (error) {
      const action = errorActionOf(error);
      if (!keepKeyAfter(action)) attempt.current = null;
      if (action === 'conflict') {
        void queryClient.invalidateQueries({ queryKey: examAttendanceRosterKey(tenantId, target) });
      }
      if (action === 'feature-denied') {
        // API_CONTRACT §4: the cached license is out of date; the visibility rule then drops the feature.
        void queryClient.invalidateQueries({ queryKey: mySchoolsKey() });
      }
      if (action === 'forbidden' && tenantId) {
        // API_CONTRACT §4: a plain 403 means the cached permissions or assignments may be out of date. The server refuses
        // the whole save when one student is outside the teacher's classes, so refresh what the lists were built from.
        void queryClient.invalidateQueries({ queryKey: myPermissionsKey(tenantId) });
        void queryClient.invalidateQueries({ queryKey: examAttendanceExamsKey(tenantId) });
        void queryClient.invalidateQueries({ queryKey: examAttendanceRosterKey(tenantId, target) });
        void queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, 'teacher', 'my-classes') });
      }
      return { kind: 'error', action, message: error instanceof ApiError ? error.message : '' };
    } finally {
      inFlight.current = false;
    }
  }

  return { submit, isPending: mutation.isPending };
}
