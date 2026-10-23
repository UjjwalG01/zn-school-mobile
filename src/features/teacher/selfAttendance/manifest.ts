import type { FeatureManifest } from '../../types';
import { TEACHER_SELF_ATTENDANCE_ACCESS } from '../access';

// "My Attendance" is a subtab of the Attendance tab (`placement: 'menu'`, `tab`), not a tab of its own.
// Its access is the shared constant, so the Attendance tab's subtab control and this manifest share one rule.
export const teacherSelfAttendanceFeature: FeatureManifest = {
  ...TEACHER_SELF_ATTENDANCE_ACCESS,
  id: 'teacher.selfAttendance',
  title: 'selfAttendance.title',
  icon: 'calendar-outline',
  placement: 'menu',
  tab: 'teacher.attendance',
  order: 21,
  routes: () => import('./MyAttendanceScreen'),
};
