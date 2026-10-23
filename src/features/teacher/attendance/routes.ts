import type { TeacherPlacement } from '../../../api/types/portal';

/**
 * The roster route for a class/section. No `date` param: the roster opens on today (computed when
 * the screen mounts), so a link kept in the stack never carries yesterday's date. A class with no
 * sections has no `sectionId`.
 */
export const rosterHref = (placement: Pick<TeacherPlacement, 'classId' | 'sectionId'>) =>
  ({
    pathname: '/teacher/attendance/roster',
    params: { classId: placement.classId, ...(placement.sectionId ? { sectionId: placement.sectionId } : {}) },
  }) as const;

/**
 * The Attendance tab on its Student Attendance subtab (the class list). It names `subtab` because
 * `AttendanceTabScreen` keeps no state of its own: the param is the open subtab, and a link without it
 * would leave a previous "My Attendance" open.
 */
export const ATTENDANCE_TAB_HREF = { pathname: '/teacher/attendance', params: { subtab: 'students' } } as const;
