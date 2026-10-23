import { teacherAcademicFeature } from './teacher/academic/manifest';
import { teacherAssignmentsFeature } from './teacher/assignments/manifest';
import { teacherCalendarFeature } from './teacher/calendar/manifest';
import { teacherAttendanceFeature } from './teacher/attendance/manifest';
import { teacherExamAttendanceFeature } from './teacher/examAttendance/manifest';
import { teacherHomeFeature } from './teacher/home/manifest';
import { teacherMarksFeature } from './teacher/marks/manifest';
import { teacherMoreFeature } from './teacher/more/manifest';
import { teacherProfileFeature } from './teacher/profile/manifest';
import { teacherSelfAttendanceFeature } from './teacher/selfAttendance/manifest';
import type { FeatureManifest } from './types';

/**
 * The only list of feature manifests (.claude/rules/mobile-frontend.md §8). Do not add tabs or
 * routes outside this registry. Keep the list equal to `order`. The tab bar is the `placement: 'tab'`
 * entries; a `menu` entry is listed inside the tab it names in `tab`.
 */
export const featureRegistry: readonly FeatureManifest[] = [
  teacherHomeFeature,
  teacherAttendanceFeature,
  teacherSelfAttendanceFeature,
  teacherAcademicFeature,
  teacherAssignmentsFeature,
  teacherMarksFeature,
  teacherExamAttendanceFeature,
  teacherMoreFeature,
  teacherCalendarFeature,
  teacherProfileFeature,
];
