import type { FeatureManifest } from '../../types';

// Always visible: it holds Switch school and Sign out, so no permission, license or module key can hide it.
export const teacherProfileFeature: FeatureManifest = {
  id: 'teacher.profile',
  audience: 'teacher',
  title: 'tabs.profile',
  icon: 'person-circle-outline',
  requiredPermission: null,
  requiredEntitlement: null,
  mobileModuleKey: null,
  placement: 'tab',
  order: 50,
  routes: () => import('../../profile/ProfileScreen'),
};
