import type { FeatureManifest } from '../../types';
import { TEACHER_NOTIFICATIONS_ACCESS } from '../access';

// Listed inside the More hub like the Calendar, and opened from the bell in every header (`NotificationBell`). It is the
// same inbox guardians will read; only this teacher entry exists today.
export const teacherNotificationsFeature: FeatureManifest = {
  ...TEACHER_NOTIFICATIONS_ACCESS,
  id: 'teacher.notifications',
  title: 'notifications.title',
  icon: 'notifications-outline',
  placement: 'menu',
  tab: 'teacher.more',
  order: 42,
  routes: () => import('./NotificationsScreen'),
};
