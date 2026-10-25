import { shellHeaderOptions } from '../../../components/BrandHeader';
import { NotificationBell } from '../../notifications/NotificationBell';
import { NOTIFICATIONS_HREF } from './routes';

/** `screenOptions` of every navigator in the teacher shell: the brand header with the notification bell at its end. */
export const teacherHeaderOptions = shellHeaderOptions(<NotificationBell href={NOTIFICATIONS_HREF} />);
