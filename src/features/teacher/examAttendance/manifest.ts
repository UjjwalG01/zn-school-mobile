import type { FeatureManifest } from '../../types';
import { TEACHER_EXAM_ATTENDANCE_ACCESS } from '../access';

// Listed inside the Academic hub, beside Marks entry. The route is `exam-attendance` (`routeName` keeps the dash).
export const teacherExamAttendanceFeature: FeatureManifest = {
  ...TEACHER_EXAM_ATTENDANCE_ACCESS,
  id: 'teacher.exam-attendance',
  title: 'examAttendance.title',
  icon: 'clipboard-outline',
  placement: 'menu',
  tab: 'teacher.academic',
  order: 33,
  routes: () => import('./ExamAttendanceListScreen'),
};
