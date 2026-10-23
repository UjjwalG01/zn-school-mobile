import type { FeatureManifest } from '../../types';

// The More hub: lists the `menu` features that name it in `tab` (the Academic Calendar today). No module key: a school
// cannot switch it off, each child carries its own. `stack`: the hub opens its children in a nested stack with its own
// header, as the Academic hub does.
export const teacherMoreFeature: FeatureManifest = {
  id: 'teacher.more',
  audience: 'teacher',
  title: 'tabs.more',
  icon: 'ellipsis-horizontal-circle-outline',
  requiredPermission: null,
  requiredEntitlement: null,
  mobileModuleKey: null,
  placement: 'tab',
  stack: true,
  order: 40,
  routes: () => import('./MoreScreen'),
};
