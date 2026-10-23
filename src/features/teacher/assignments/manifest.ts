import type { FeatureManifest } from '../../types';

// No permission is required here: the backend answers `my-classes` for `attendance.mark` or
// `exam_result.save`, and a 403 shows "no access" (FEATURE_MODULES §4). `my_classes` is a new
// mobile-module key; until the backend web list has it a school cannot switch it off (a missing
// row means visible).
export const teacherAssignmentsFeature: FeatureManifest = {
  id: 'teacher.assignments',
  audience: 'teacher',
  title: 'assignments.title',
  icon: 'people-outline',
  requiredPermission: null,
  requiredEntitlement: 'academic',
  mobileModuleKey: 'my_classes',
  placement: 'menu',
  tab: 'teacher.academic',
  order: 31,
  routes: () => import('./AssignmentsScreen'),
};
