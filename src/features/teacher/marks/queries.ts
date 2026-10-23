// Marks reads (docs/project/MARKS_PLAN.md §6). Both are Daily class (5 min, persisted, wiped on
// logout and school switch by their tenant-prefixed keys); no new class. The exam list itself is
// `useTeacherExams` (it carries the submission state and the components).
import { useQuery } from '@tanstack/react-query';

import { type ExamRosterQuery, getExamResults, getExamRoster } from '../../../api/academic';
import { tenantKey, userKey } from '../../../api/queryKeys';
import { STALE_TIME } from '../../../api/staleTime';
import { useSession } from '../../../auth/session';

export const examRosterKey = (tenantId: string | null, query: ExamRosterQuery) =>
  tenantId
    ? tenantKey(tenantId, 'teacher', 'marks', 'roster', query.examId, query.sectionId ?? 'none')
    : userKey('marks-roster', 'no-school');

export const examResultsKey = (tenantId: string | null, examId: string) =>
  tenantId ? tenantKey(tenantId, 'teacher', 'marks', 'results', examId) : userKey('marks-results', 'no-school');

/** `query = null` (a subject that is no longer open) keeps the request off. */
export function useExamRoster(query: ExamRosterQuery | null) {
  const { tenantId } = useSession();
  return useQuery({
    queryKey: query ? examRosterKey(tenantId, query) : userKey('marks-roster', 'no-subject'),
    queryFn: () => getExamRoster(query!),
    staleTime: STALE_TIME.daily,
    enabled: tenantId !== null && query !== null,
  });
}

/** Another teacher can save the same students (a different subject), so a refetch after a conflict matters. */
export function useExamResults(examId: string | null) {
  const { tenantId } = useSession();
  return useQuery({
    queryKey: examId ? examResultsKey(tenantId, examId) : userKey('marks-results', 'no-subject'),
    queryFn: () => getExamResults(examId!),
    staleTime: STALE_TIME.daily,
    enabled: tenantId !== null && examId !== null,
  });
}
