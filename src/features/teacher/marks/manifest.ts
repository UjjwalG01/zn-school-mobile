import type { FeatureManifest } from '../../types';
import { TEACHER_MARKS_ACCESS } from '../access';

// Marks entry is listed inside the Academic hub (`placement: 'menu'`, `tab`), like My classes. Its
// access is the shared constant Home and the hub already gate their read-only exam cards on, so the
// card and the screen share one rule (`exam_result.save`, the academic licence, mobile module `exams`).
// docs/project/MARKS_PLAN.md.
export const teacherMarksFeature: FeatureManifest = {
  ...TEACHER_MARKS_ACCESS,
  id: 'teacher.marks',
  title: 'academic.marks',
  icon: 'create-outline',
  placement: 'menu',
  tab: 'teacher.academic',
  order: 32,
  routes: () => import('./MarksListScreen'),
};
