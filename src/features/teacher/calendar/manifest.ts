import type { FeatureManifest } from '../../types';
import { TEACHER_CALENDAR_ACCESS } from '../access';

// Listed inside the More hub (`placement: 'menu'`, `tab`), the way My classes and Marks entry are listed inside the
// Academic hub. Access is the shared constant in `access.ts`.
export const teacherCalendarFeature: FeatureManifest = {
  ...TEACHER_CALENDAR_ACCESS,
  id: 'teacher.calendar',
  title: 'calendar.title',
  icon: 'calendar-number-outline',
  placement: 'menu',
  tab: 'teacher.more',
  order: 41,
  routes: () => import('./CalendarScreen'),
};
