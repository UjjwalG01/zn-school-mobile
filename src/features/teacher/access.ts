// Who may see the attendance and marks areas, from docs/architecture/FEATURE_MODULES.md §4. Home
// gates its sections on these before the Attendance and Marks features exist; their manifests
// spread the same values later so the rule has one source. UX hint only — the backend enforces.
import type { FeatureAccess } from '../visibility';

export const TEACHER_ATTENDANCE_ACCESS: FeatureAccess = {
  audience: 'teacher',
  requiredPermission: 'attendance.mark',
  requiredEntitlement: 'academic',
  mobileModuleKey: 'attendance',
};

export const TEACHER_SELF_ATTENDANCE_ACCESS: FeatureAccess = {
  audience: 'teacher',
  requiredPermission: 'attendance.self',
  requiredEntitlement: 'academic',
  mobileModuleKey: 'attendance',
};

export const TEACHER_MARKS_ACCESS: FeatureAccess = {
  audience: 'teacher',
  requiredPermission: 'exam_result.save',
  requiredEntitlement: 'academic',
  mobileModuleKey: 'exams',
};

// "Student details", opened from an Attendance roster row (docs/project/STUDENT_INFO_PLAN.md, SI-D1,
// SI-D4). Not a feature manifest: it is a detail screen of `teacher.attendance`, so it needs no registry
// entry. It follows the roster's permission and licence and has its own school switch (`students`), so
// a school can hide student details from phones without hiding attendance.
export const TEACHER_STUDENT_INFO_ACCESS: FeatureAccess = {
  audience: 'teacher',
  requiredPermission: 'attendance.mark',
  requiredEntitlement: 'academic',
  mobileModuleKey: 'students',
};

// The Academic Calendar (More hub; docs/project/CALENDAR_AND_EXAM_ATTENDANCE_PLAN.md). `calendar.read` is the key the
// API checks on `GET /calendar`; `calendar` is a mobile-module key no school has switched off yet, so a missing row means
// visible (the same way `my_classes` started). Notices on the same screen are membership-only and filtered by the server.
export const TEACHER_CALENDAR_ACCESS: FeatureAccess = {
  audience: 'teacher',
  requiredPermission: 'calendar.read',
  requiredEntitlement: 'academic',
  mobileModuleKey: 'calendar',
};

// The notification inbox (More hub and the header bell). `GET /portal/notifications` is membership-only and returns only
// the caller's own rows, and the Communication module has no licence key yet, so there is no permission, entitlement or
// school switch to hint at: the bell is for everyone signed in to a school (a 403 would still be shown, not hidden).
export const TEACHER_NOTIFICATIONS_ACCESS: FeatureAccess = {
  audience: 'teacher',
  requiredPermission: null,
  requiredEntitlement: null,
  mobileModuleKey: null,
};

// Exam attendance (Academic hub). `exam_attendance.mark` opens the roster and the save; a teacher is limited by the
// server to the classes they are assigned to unless the role also holds `exam_attendance.mark_any`, which the app never
// reads: the lists it is given are already the right ones. Shares the `exams` school switch with marks entry.
export const TEACHER_EXAM_ATTENDANCE_ACCESS: FeatureAccess = {
  audience: 'teacher',
  requiredPermission: 'exam_attendance.mark',
  requiredEntitlement: 'academic',
  mobileModuleKey: 'exams',
};
