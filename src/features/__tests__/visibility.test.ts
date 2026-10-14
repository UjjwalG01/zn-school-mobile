import { featureRegistry } from '../registry';
import type { FeatureManifest, VisibilityContext } from '../types';
import { isFeatureVisible, visibleFeatures } from '../visibility';

const feature = (overrides: Partial<FeatureManifest> = {}): FeatureManifest => ({
  id: 'teacher.attendance',
  audience: 'teacher',
  title: 'Attendance',
  icon: 'calendar-check',
  requiredPermission: 'attendance.mark',
  requiredEntitlement: 'academic',
  mobileModuleKey: 'attendance',
  placement: 'tab',
  order: 20,
  routes: async () => ({}),
  ...overrides,
});

const ctx = (overrides: Partial<VisibilityContext> = {}): VisibilityContext => ({
  audience: 'teacher',
  permissions: { all: false, keys: ['attendance.mark'] },
  licenseModules: ['academic'],
  mobileModules: {},
  ...overrides,
});

describe('isFeatureVisible', () => {
  it('shows a feature when every condition holds (missing mobile-module row = visible)', () => {
    expect(isFeatureVisible(feature(), ctx())).toBe(true);
  });

  it('hides a feature for the other audience, but not a shared one', () => {
    expect(isFeatureVisible(feature(), ctx({ audience: 'guardian' }))).toBe(false);
    expect(isFeatureVisible(feature({ audience: 'both' }), ctx({ audience: 'guardian' }))).toBe(true);
  });

  it('hides when the permission is missing, unless all = true', () => {
    const noPerm = ctx({ permissions: { all: false, keys: [] } });
    expect(isFeatureVisible(feature(), noPerm)).toBe(false);
    expect(isFeatureVisible(feature(), ctx({ permissions: { all: true, keys: [] } }))).toBe(true);
  });

  it('ignores permission when the feature requires none (guardian features)', () => {
    const guardian = feature({ audience: 'guardian', requiredPermission: null });
    expect(
      isFeatureVisible(guardian, ctx({ audience: 'guardian', permissions: { all: false, keys: [] } })),
    ).toBe(true);
  });

  it('hides when the license lacks the entitlement', () => {
    expect(isFeatureVisible(feature(), ctx({ licenseModules: ['fees'] }))).toBe(false);
  });

  it('hides when the school disabled the module for mobile', () => {
    expect(isFeatureVisible(feature(), ctx({ mobileModules: { attendance: false } }))).toBe(false);
    expect(isFeatureVisible(feature(), ctx({ mobileModules: { attendance: true } }))).toBe(true);
  });
});

describe('visibleFeatures', () => {
  it('filters and sorts by order', () => {
    const list = [
      feature({ id: 'b', order: 30 }),
      feature({ id: 'hidden', audience: 'guardian' }),
      feature({ id: 'a', order: 10 }),
    ];
    expect(visibleFeatures(list, ctx()).map((f) => f.id)).toEqual(['a', 'b']);
  });
});

describe('featureRegistry', () => {
  it('has unique ids', () => {
    const ids = featureRegistry.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
