import type { Href } from 'expo-router';

/**
 * A student's details, inside the Attendance stack (opened from a roster row). A cast string, like
 * `marksEntryHref`: a brand-new route is not in the typed-routes file until the owner's Metro regenerates it.
 */
export const studentHref = (studentId: string): Href =>
  `/teacher/attendance/student?studentId=${encodeURIComponent(studentId)}` as Href;
