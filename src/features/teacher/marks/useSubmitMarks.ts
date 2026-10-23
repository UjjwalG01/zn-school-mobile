// The two marks writes (docs/project/MARKS_PLAN.md §4, §6): the bulk save of changed students and
// handing a subject in. Nothing here retries a POST: the only retry is the teacher pressing the
// button again. The save's idempotency key follows the payload (same bytes keep the key, so a request
// that may have reached the server is replayed, not duplicated; any edit gets a new one). Submit is
// idempotent on the backend (an already submitted subject answers the same row), so it needs no key.
import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { postBulkMarks, submitSubjectMarks } from '../../../api/academic';
import { ApiError, type ApiErrorAction, errorActionOf } from '../../../api/errors';
import { tenantKey } from '../../../api/queryKeys';
import type { BulkMarksItem, BulkMarksRequest, ExamResult } from '../../../api/types/academic';
import type { TeacherExam } from '../../../api/types/portal';
import { myPermissionsKey, mySchoolsKey } from '../../../auth/queries';
import { useSession } from '../../../auth/session';
import { attemptFor, keepKeyAfter, type PendingAttempt } from '../../../lib/idempotency';
import { newUuid } from '../../../lib/uuid';
import { teacherExamsKey } from '../queries';
import {
  failuresByEnrollment,
  MAX_BULK_ITEMS,
  mergeResults,
  payloadSignature,
  type SlotRef,
  withSubmission,
} from './marksModel';
import { examResultsKey } from './queries';

export interface WriteError {
  kind: 'error';
  action: ApiErrorAction;
  /** The backend `errorCode`, for the few the screen words itself (`EXAM_MARKS_SUBMITTED`, `EXAM_MARKS_INCOMPLETE`). */
  code: string | undefined;
  message: string;
}

export type SaveOutcome =
  /** Nothing sent: a save is already running, or there is nothing (or too much) to send. */
  | { kind: 'ignored' }
  | { kind: 'saved'; replayed: boolean; savedIds: string[] }
  /** 2xx `ok:false`: nothing was written; `failures` is enrollmentId → the backend's reason. */
  | { kind: 'refused'; failures: Record<string, string> }
  | WriteError;

export type SubmitOutcome = { kind: 'ignored' } | { kind: 'submitted' } | WriteError;

/** What every failed marks write does to the caches (API_CONTRACT §4), then the error for the screen. */
function failed(error: unknown, queryClient: QueryClient, tenantId: string | null, examId: string): WriteError {
  const action = errorActionOf(error);
  if (action === 'conflict') {
    // Fresh versions and the submission state explain the conflict.
    void queryClient.invalidateQueries({ queryKey: examResultsKey(tenantId, examId) });
    void queryClient.invalidateQueries({ queryKey: teacherExamsKey(tenantId) });
  }
  if (action === 'feature-denied') {
    // The cached license is out of date; the visibility rule then drops the feature.
    void queryClient.invalidateQueries({ queryKey: mySchoolsKey() });
  }
  if (action === 'forbidden' && tenantId) {
    // A plain 403: the cached assignments / permissions may be out of date.
    void queryClient.invalidateQueries({ queryKey: myPermissionsKey(tenantId) });
    void queryClient.invalidateQueries({ queryKey: teacherExamsKey(tenantId) });
    void queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, 'teacher', 'my-classes') });
  }
  return {
    kind: 'error',
    action,
    code: error instanceof ApiError ? error.errorCode : undefined,
    message: error instanceof ApiError ? error.message : '',
  };
}

export function useSaveMarks(examId: string) {
  const queryClient = useQueryClient();
  const { tenantId } = useSession();
  const attempt = useRef<PendingAttempt | null>(null);
  // `isPending` only flips on the next render; this closes the gap between two quick taps.
  const inFlight = useRef(false);
  // Wrapped so TanStack's second (context) argument never reaches the request function.
  const mutation = useMutation({ mutationFn: (body: BulkMarksRequest) => postBulkMarks(body) });

  async function save(items: readonly BulkMarksItem[]): Promise<SaveOutcome> {
    if (inFlight.current || items.length === 0 || items.length > MAX_BULK_ITEMS) return { kind: 'ignored' };

    const payload = { examId, items: [...items] };
    attempt.current = attemptFor(payloadSignature(payload), attempt.current, newUuid);

    inFlight.current = true;
    try {
      const result = await mutation.mutateAsync({ ...payload, idempotencyKey: attempt.current.key });
      attempt.current = null; // answered (saved or refused): the key is spent

      if (result.ok) {
        // Use the write response instead of a refetch (api-and-data §7): the new versions and marks.
        queryClient.setQueryData<ExamResult[]>(
          examResultsKey(tenantId, examId),
          (results) => results && mergeResults(results, result.results),
        );
        // A scoped teacher's first save opens the `draft` submission row on the backend.
        void queryClient.invalidateQueries({ queryKey: teacherExamsKey(tenantId) });
        return { kind: 'saved', replayed: result.replayed === true, savedIds: result.results.map((r) => r.enrollmentId) };
      }

      // Nothing was written. Fresh versions explain any conflict behind a refusal.
      void queryClient.invalidateQueries({ queryKey: examResultsKey(tenantId, examId) });
      return { kind: 'refused', failures: failuresByEnrollment(result.failures) };
    } catch (error) {
      const outcome = failed(error, queryClient, tenantId, examId);
      if (!keepKeyAfter(outcome.action)) attempt.current = null;
      return outcome;
    } finally {
      inFlight.current = false;
    }
  }

  return { save, isPending: mutation.isPending };
}

/** `submission` version is the one last read (0 = none yet); the caller disables Submit while the exam list refetches. */
export function useSubmitSubject(slot: SlotRef) {
  const queryClient = useQueryClient();
  const { tenantId } = useSession();
  const inFlight = useRef(false);
  const mutation = useMutation({
    mutationFn: (version: number) =>
      submitSubjectMarks(slot.examId, slot.examSubjectId, {
        ...(slot.sectionId ? { sectionId: slot.sectionId } : {}),
        version,
      }),
  });

  async function submit(version: number): Promise<SubmitOutcome> {
    if (inFlight.current) return { kind: 'ignored' };
    inFlight.current = true;
    try {
      const row = await mutation.mutateAsync(version);
      queryClient.setQueryData<TeacherExam[]>(teacherExamsKey(tenantId), (exams) => exams && withSubmission(exams, slot, row));
      return { kind: 'submitted' };
    } catch (error) {
      return failed(error, queryClient, tenantId, slot.examId);
    } finally {
      inFlight.current = false;
    }
  }

  return { submit, isPending: mutation.isPending };
}
