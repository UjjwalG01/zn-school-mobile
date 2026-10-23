import { useVisibilityContext } from '../../useVisibleFeatures';
import { isFeatureVisible } from '../../visibility';
import { TEACHER_STUDENT_INFO_ACCESS } from '../access';

/** Whether the Attendance roster offers "Student details" (a UX hint; the backend decides per student). */
export function useCanOpenStudent(): boolean {
  const ctx = useVisibilityContext('teacher');
  return ctx !== null && isFeatureVisible(TEACHER_STUDENT_INFO_ACCESS, ctx);
}
