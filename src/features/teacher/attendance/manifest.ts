import type { FeatureManifest } from '../../types';
import { TEACHER_ATTENDANCE_ACCESS } from '../access';

// Access (attendance.mark, academic, mobile module `attendance`) is spread from `access.ts`, the same
// constant Home gates its Attendance block on, so the rule has one source. `stack`: the tab is a
// nested stack (subtabs, then roster) that draws its own header. The tab also shows for a teacher who
// only holds `attendance.self`, through `teacher.selfAttendance` (`visibleTabs`).
export const teacherAttendanceFeature: FeatureManifest = {
  ...TEACHER_ATTENDANCE_ACCESS,
  id: 'teacher.attendance',
  title: 'attendance.title',
  icon: 'calendar-outline',
  placement: 'tab',
  order: 20,
  stack: true,
  routes: () => import('./AttendanceTabScreen'),
};
