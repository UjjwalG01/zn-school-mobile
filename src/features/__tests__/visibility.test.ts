import type { School } from '../../api/types/tenancy';
import { featureRegistry } from '../registry';
import type { FeatureManifest, VisibilityContext } from '../types';
import {
  buildVisibilityContext,
  isFeatureVisible,
  type VisibilityInputs,
  visibleFeatures,
  visibleTabs,
} from '../visibility';

const feature = (overrides: Partial<FeatureManifest> = {}): FeatureManifest => ({
  id: 'teacher.attendance',
  audience: 'teacher',
  title: 'shell.home',
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

  it('has no school switch when the module key is null (Profile, More)', () => {
    const always = feature({ mobileModuleKey: null, requiredPermission: null, requiredEntitlement: null });
    const everythingOff = ctx({
      permissions: { all: false, keys: [] },
      licenseModules: [],
      mobileModules: { attendance: false, my_dashboard: false },
    });
    expect(isFeatureVisible(always, everythingOff)).toBe(true);
  });
});

describe('visibleTabs', () => {
  const tab = (id: string, order: number, overrides: Partial<FeatureManifest> = {}) =>
    feature({ id, order, placement: 'tab', ...overrides });
  const child = (id: string, hosts: string, overrides: Partial<FeatureManifest> = {}) =>
    feature({ id, placement: 'menu', tab: hosts, requiredPermission: 'attendance.self', ...overrides });

  it('lists only tab features, by order', () => {
    const list = [tab('b', 20), child('c', 'b'), tab('a', 10)];
    expect(visibleTabs(list, ctx()).map((f) => f.id)).toEqual(['a', 'b']);
  });

  it('shows a tab whose own rule fails while a visible feature it hosts passes', () => {
    const attendance = tab('teacher.attendance', 10); // needs attendance.mark
    const self = child('teacher.selfAttendance', 'teacher.attendance');
    const onlySelf = ctx({ permissions: { all: false, keys: ['attendance.self'] } });
    expect(visibleTabs([attendance, self], onlySelf).map((f) => f.id)).toEqual(['teacher.attendance']);
    expect(visibleTabs([attendance, self], ctx({ permissions: { all: false, keys: [] } }))).toEqual([]);
  });

  it('does not show a tab for a hosted feature that is itself hidden', () => {
    const attendance = tab('teacher.attendance', 10, { requiredPermission: 'attendance.read' });
    const self = child('teacher.selfAttendance', 'teacher.attendance', { mobileModuleKey: 'attendance' });
    const hiddenModule = ctx({
      permissions: { all: false, keys: ['attendance.self'] },
      mobileModules: { attendance: false },
    });
    expect(visibleTabs([attendance, self], hiddenModule)).toEqual([]);
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

const school = (tenantId: string, modules: string[]): School => ({
  tenantId,
  name: `School ${tenantId}`,
  status: 'active',
  license: { status: 'active', tierName: null, validUntil: null, expiringSoon: false, modules },
});

const inputs = (overrides: Partial<VisibilityInputs> = {}): VisibilityInputs => ({
  audience: 'teacher',
  tenantId: 't1',
  permissions: { all: false, keys: ['attendance.mark'] },
  schools: [school('t1', ['academic']), school('t2', ['fees'])],
  mobileModules: [],
  ...overrides,
});

describe('buildVisibilityContext', () => {
  it('uses the selected school license modules and the permission hint', () => {
    expect(buildVisibilityContext(inputs())).toEqual({
      audience: 'teacher',
      permissions: { all: false, keys: ['attendance.mark'] },
      licenseModules: ['academic'],
      mobileModules: {},
    });
    expect(buildVisibilityContext(inputs({ tenantId: 't2' }))?.licenseModules).toEqual(['fees']);
  });

  it('is null until permissions and the selected school are known, so nothing is shown', () => {
    expect(buildVisibilityContext(inputs({ permissions: undefined }))).toBeNull();
    expect(buildVisibilityContext(inputs({ schools: undefined }))).toBeNull();
    expect(buildVisibilityContext(inputs({ tenantId: null }))).toBeNull();
    expect(buildVisibilityContext(inputs({ tenantId: 'other' }))).toBeNull();
  });

  it('turns mobile-module rows into a lookup; a missing or failed read means visible', () => {
    const toggled = buildVisibilityContext(
      inputs({ mobileModules: [{ moduleKey: 'attendance', visible: false }] }),
    );
    expect(toggled?.mobileModules).toEqual({ attendance: false });
    expect(isFeatureVisible(feature(), toggled!)).toBe(false);

    const missing = buildVisibilityContext(inputs({ mobileModules: undefined }));
    expect(missing?.mobileModules).toEqual({});
    expect(isFeatureVisible(feature(), missing!)).toBe(true);
  });
});

describe('featureRegistry', () => {
  it('has unique ids', () => {
    const ids = featureRegistry.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
