import { useCallback, useMemo, useReducer } from 'react';

import type { AttendanceStatus, RosterRow } from '../../../api/types/attendance';
import {
  discardEdit,
  type Draft,
  EMPTY_DRAFT,
  keepMine,
  markRemainingPresent,
  setRemarks,
  setStatus,
} from './attendanceModel';

type Action =
  | { type: 'status'; row: RosterRow; status: AttendanceStatus }
  | { type: 'remarks'; row: RosterRow; remarks: string }
  | { type: 'markRemaining'; rows: readonly RosterRow[] }
  | { type: 'keepMine'; row: RosterRow }
  | { type: 'discard'; studentId: string }
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
      return discardEdit(draft, action.studentId);
    case 'reset':
      return EMPTY_DRAFT;
  }
}

/**
 * The teacher's unsaved edits, in memory only (TEACHER_FEATURES §2.3). The returned callbacks are
 * stable, so a memoized row re-renders only when its own edit changes.
 */
export function useAttendanceDraft() {
  const [draft, dispatch] = useReducer(reducer, EMPTY_DRAFT);
  const actions = useMemo(
    () => ({
      setStatus: (row: RosterRow, status: AttendanceStatus) => dispatch({ type: 'status', row, status }),
      setRemarks: (row: RosterRow, remarks: string) => dispatch({ type: 'remarks', row, remarks }),
      markRemaining: (rows: readonly RosterRow[]) => dispatch({ type: 'markRemaining', rows }),
      keepMine: (row: RosterRow) => dispatch({ type: 'keepMine', row }),
      discard: (studentId: string) => dispatch({ type: 'discard', studentId }),
    }),
    [],
  );
  const reset = useCallback(() => dispatch({ type: 'reset' }), []);
  return { draft, ...actions, reset };
}
