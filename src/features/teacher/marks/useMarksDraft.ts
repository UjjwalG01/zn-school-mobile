import { useCallback, useMemo, useReducer } from 'react';

import type { ExamResult } from '../../../api/types/academic';
import { dropEntries, type Draft, EMPTY_DRAFT, keepMine, setValue } from './marksModel';

type Action =
  | { type: 'value'; enrollmentId: string; result: ExamResult | undefined; componentId: string; text: string }
  | { type: 'keepMine'; enrollmentId: string; result: ExamResult | undefined }
  | { type: 'drop'; enrollmentIds: readonly string[] }
  | { type: 'reset' };

function reducer(draft: Draft, action: Action): Draft {
  switch (action.type) {
    case 'value':
      return setValue(draft, action.enrollmentId, action.result, action.componentId, action.text);
    case 'keepMine':
      return keepMine(draft, action.enrollmentId, action.result);
    case 'drop':
      return dropEntries(draft, action.enrollmentIds);
    case 'reset':
      return EMPTY_DRAFT;
  }
}

/**
 * The teacher's unsaved marks, in memory only (MARKS_PLAN M-D2). The returned callbacks are stable,
 * so a memoized row re-renders only when its own edit changes.
 */
export function useMarksDraft() {
  const [draft, dispatch] = useReducer(reducer, EMPTY_DRAFT);
  const actions = useMemo(
    () => ({
      setValue: (enrollmentId: string, result: ExamResult | undefined, componentId: string, text: string) =>
        dispatch({ type: 'value', enrollmentId, result, componentId, text }),
      keepMine: (enrollmentId: string, result: ExamResult | undefined) =>
        dispatch({ type: 'keepMine', enrollmentId, result }),
      drop: (enrollmentIds: readonly string[]) => dispatch({ type: 'drop', enrollmentIds }),
    }),
    [],
  );
  const reset = useCallback(() => dispatch({ type: 'reset' }), []);
  return { draft, ...actions, reset };
}
