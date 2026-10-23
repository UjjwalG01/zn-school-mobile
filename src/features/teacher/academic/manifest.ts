import type { FeatureManifest } from '../../types';

// A hub tab that lists the `menu` features naming it in `tab` (My classes today). No module key:
// each child carries its own, and the hub only needs the academic license. `stack`: the hub opens
// its children in a nested stack with its own header.
export const teacherAcademicFeature: FeatureManifest = {
  id: 'teacher.academic',
  audience: 'teacher',
  title: 'tabs.academic',
  icon: 'school-outline',
  requiredPermission: null,
  requiredEntitlement: 'academic',
  mobileModuleKey: null,
  placement: 'tab',
  stack: true,
  order: 30,
  routes: () => import('./AcademicHubScreen'),
};
