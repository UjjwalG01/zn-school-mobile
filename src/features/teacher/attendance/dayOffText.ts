import type { DayInfo } from '../../../api/types/attendance';
import { t } from '../../../i18n';

/** Why the day cannot be marked, from `dayInfo` as returned (the app keeps no calendar of its own). */
export function dayOffText(dayInfo: DayInfo): string {
  if (dayInfo.reason === 'holiday' && dayInfo.holidayName) {
    return t('attendance.dayHoliday', { name: dayInfo.holidayName });
  }
  if (dayInfo.reason === 'weekly_off') return t('attendance.dayWeeklyOff');
  return t('attendance.dayOff');
}
