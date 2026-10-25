import { menuHref } from '../../routes';
import { teacherNotificationsFeature } from './manifest';

/** Where the header bell goes: the inbox, inside the More stack. */
export const NOTIFICATIONS_HREF = menuHref(teacherNotificationsFeature);
