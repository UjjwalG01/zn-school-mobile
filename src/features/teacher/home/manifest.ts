import type { FeatureManifest } from '../../types';

// Folder is `teacher/home` (dots in folder names are awkward); the id stays `teacher.home`.
export const teacherHomeFeature: FeatureManifest = {
  id: 'teacher.home',
  audience: 'teacher',
  title: 'tabs.dashboard',
  icon: 'home-outline',
  requiredPermission: null,
  requiredEntitlement: null,
  mobileModuleKey: 'my_dashboard',
  placement: 'tab',
  order: 10,
  routes: () => import('./HomeScreen'),
};
