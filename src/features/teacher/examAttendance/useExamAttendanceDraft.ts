import { useCallback, useMemo, useReducer } from 'react';

import type { ExamAttendanceRow, ExamAttendanceStatus } from '../../../api/types/examAttendance';
import {
  discardEdit,
  type Draft,
  EMPTY_DRAFT,
  keepMine,
  markRemainingPresent,
  setRemarks,
  setStatus,
} from './examAttendanceModel';

type Action =
  | { type: 'status'; row: ExamAttendanceRow; status: ExamAttendanceStatus }
  | { type: 'remarks'; row: ExamAttendanceRow; remarks: string }
  | { type: 'markRemaining'; rows: readonly ExamAttendanceRow[] }
  | { type: 'keepMine'; row: ExamAttendanceRow }
  | { type: 'discard'; enrollmentId: string }
  | { type: 'reset' };

function reducer(draft: Draft, action: Action): Draft {
  switch (action.type) {
    case 'status':
      return setStatus(draft, action.row, action.status);
    case 'remarks':
      return setRemarks(draft, action.row, action.remarks);
    case 'markRemaining':
      return markRemainingPresent(draft, action.rows);
    case 'keepMine':
      return keepMine(draft, action.row);
    case 'discard':
      return discardEdit(draft, action.enrollmentId);
    case 'reset':
      return EMPTY_DRAFT;
  }
}

/** The teacher's unsaved edits, in memory only. The returned callbacks are stable, so a memoized row re-renders only when its own edit changes. */
export function useExamAttendanceDraft() {
  const [draft, dispatch] = useReducer(reducer, EMPTY_DRAFT);
  const actions = useMemo(
    () => ({
      setStatus: (row: ExamAttendanceRow, status: ExamAttendanceStatus) => dispatch({ type: 'status', row, status }),
      setRemarks: (row: ExamAttendanceRow, remarks: string) => dispatch({ type: 'remarks', row, remarks }),
      markRemaining: (rows: readonly ExamAttendanceRow[]) => dispatch({ type: 'markRemaining', rows }),
      keepMine: (row: ExamAttendanceRow) => dispatch({ type: 'keepMine', row }),
      discard: (enrollmentId: string) => dispatch({ type: 'discard', enrollmentId }),
    }),
    [],
  );
  const reset = useCallback(() => dispatch({ type: 'reset' }), []);
  return { draft, ...actions, reset };
}
