// The one bulk save (docs/project/ATTENDANCE_PLAN.md §3.7). Nothing here retries a POST: the only
// retry is the teacher pressing Save again. The idempotency key follows the payload: the same bytes
// keep the key (so a request that may have reached the server is replayed, not duplicated), any
// edit gets a new one.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { postBulkAttendance, type RosterQuery } from '../../../api/attendance';
import { ApiError, type ApiErrorAction, errorActionOf } from '../../../api/errors';
import { tenantKey } from '../../../api/queryKeys';
import type { AttendanceRoster, BulkAttendanceRequest, RosterRow } from '../../../api/types/attendance';
import { myPermissionsKey, mySchoolsKey } from '../../../auth/queries';
import { useSession } from '../../../auth/session';
import { newUuid } from '../../../lib/uuid';
import {
  applySaved,
  attemptFor,
  buildBulkRows,
  type Draft,
  failuresByStudent,
  keepKeyAfter,
  MAX_BULK_ROWS,
  type PendingAttempt,
  payloadSignature,
} from './attendanceModel';
import { attendanceRosterKey, attendanceSettingsKey } from './queries';

export type SubmitOutcome =
  /** Nothing sent: a save is already running, or there is nothing (or too much) to send. */
  | { kind: 'ignored' }
  | { kind: 'saved'; replayed: boolean }
  /** 2xx `ok:false`: nothing was written; `failures` is studentId → the backend's reason. */
  | { kind: 'refused'; failures: Record<string, string> }
  | { kind: 'error'; action: ApiErrorAction; message: string };

export function useSubmitAttendance(target: RosterQuery) {
  const queryClient = useQueryClient();
  const { tenantId } = useSession();
  const attempt = useRef<PendingAttempt | null>(null);
  // `isPending` only flips on the next render; this closes the gap between two quick taps.
  const inFlight = useRef(false);
  // Wrapped so TanStack's second (context) argument never reaches the request function.
  const mutation = useMutation({ mutationFn: (body: BulkAttendanceRequest) => postBulkAttendance(body) });

  async function submit(rows: readonly RosterRow[], draft: Draft): Promise<SubmitOutcome> {
    const records = buildBulkRows(rows, draft);
    if (inFlight.current || records.length === 0 || records.length > MAX_BULK_ROWS) return { kind: 'ignored' };

    const payload: Omit<BulkAttendanceRequest, 'idempotencyKey'> = {
      attendanceDate: target.date,
      classId: target.classId,
      ...(target.sectionId ? { sectionId: target.sectionId } : {}),
      records,
    };
    attempt.current = attemptFor(payloadSignature(payload), attempt.current, newUuid);

    inFlight.current = true;
    try {
      const result = await mutation.mutateAsync({ ...payload, idempotencyKey: attempt.current.key });
      attempt.current = null; // answered (saved or refused): the key is spent

      if (result.ok) {
        // Use the write response instead of a refetch (api-and-data §7); only this roster key changes.
        queryClient.setQueryData<AttendanceRoster>(attendanceRosterKey(tenantId, target), (roster) =>
          roster ? applySaved(roster, draft, result.results) : roster,
        );
        return { kind: 'saved', replayed: result.replayed };
      }

      // Nothing was written. Fresh versions explain any conflict; fresh settings explain "not in use".
      void queryClient.invalidateQueries({ queryKey: attendanceRosterKey(tenantId, target) });
      void queryClient.invalidateQueries({ queryKey: attendanceSettingsKey(tenantId) });
      return { kind: 'refused', failures: failuresByStudent(result.failures) };
    } catch (error) {
      const action = errorActionOf(error);
      if (!keepKeyAfter(action)) attempt.current = null;
      if (action === 'conflict') {
        void queryClient.invalidateQueries({ queryKey: attendanceRosterKey(tenantId, target) });
      }
      if (action === 'feature-denied') {
        // API_CONTRACT §4: the cached license is out of date; the visibility rule then drops the feature.
        void queryClient.invalidateQueries({ queryKey: mySchoolsKey() });
      }
      if (action === 'forbidden' && tenantId) {
        // API_CONTRACT §4: a plain 403 means the cached assignments / permissions may be out of date.
        void queryClient.invalidateQueries({ queryKey: myPermissionsKey(tenantId) });
        // my-classes is keyed by today's date, not the roster date, so invalidate by prefix.
        void queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, 'teacher', 'my-classes') });
      }
      return { kind: 'error', action, message: error instanceof ApiError ? error.message : '' };
    } finally {
      inFlight.current = false;
    }
  }

  return { submit, isPending: mutation.isPending };
}
