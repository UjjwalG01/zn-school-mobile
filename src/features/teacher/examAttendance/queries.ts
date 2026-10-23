// Exam attendance reads. The exam list and the roster are Daily class (5 min, persisted, wiped on logout and school switch
// by their tenant-prefixed key). No new class.
import { useQuery } from '@tanstack/react-query';

import { type ExamAttendanceRosterQuery, getExamAttendanceExams, getExamAttendanceRoster } from '../../../api/examAttendance';
import { tenantKey, userKey } from '../../../api/queryKeys';
import { STALE_TIME } from '../../../api/staleTime';
import { useSession } from '../../../auth/session';

export const examAttendanceExamsKey = (tenantId: string | null) =>
  tenantId ? tenantKey(tenantId, 'teacher', 'exam-attendance') : userKey('exam-attendance', 'no-school');

export const examAttendanceRosterKey = (tenantId: string | null, query: ExamAttendanceRosterQuery) =>
  tenantId
    ? tenantKey(tenantId, 'exam-attendance', 'roster', query.examId, query.examSubjectId, query.sectionId ?? 'all')
    : userKey('exam-attendance-roster', 'no-school');

/** The published exams, with their papers, the caller may record. Needs `exam_attendance.mark`; the server scopes it. */
export function useExamAttendanceExams() {
  const { tenantId } = useSession();
  return useQuery({
    queryKey: examAttendanceExamsKey(tenantId),
    queryFn: getExamAttendanceExams,
    staleTime: STALE_TIME.daily,
    enabled: tenantId !== null,
  });
}

/** `query = null` (a route without a paper) keeps the request off. Served by the primary database. */
export function useExamAttendanceRoster(query: ExamAttendanceRosterQuery | null) {
  const { tenantId } = useSession();
  return useQuery({
    queryKey: query ? examAttendanceRosterKey(tenantId, query) : userKey('exam-attendance-roster', 'no-paper'),
    queryFn: () => getExamAttendanceRoster(query!),
    staleTime: STALE_TIME.daily,
    enabled: tenantId !== null && query !== null,
  });
}
