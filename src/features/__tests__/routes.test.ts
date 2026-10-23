import { featureRegistry } from '../registry';
import { routeName } from '../routes';

// The route files pull in screens; stub the native/router edges the way the screen tests do.
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('../../auth/useSignOut', () => ({ useSignOut: () => jest.fn() }));

describe('routeName', () => {
  it('drops the audience prefix and maps home to index', () => {
    expect(routeName('teacher.home')).toBe('index');
    expect(routeName('guardian.home')).toBe('index');
    expect(routeName('teacher.attendance')).toBe('attendance');
    expect(routeName('teacher.self-attendance')).toBe('self-attendance');
  });
});

describe('registered tab features', () => {
  it('each has a route file app/<audience>/<routeName>.tsx with a default export (expo-router needs one per route)', () => {
    const tabs = featureRegistry.filter((feature) => feature.placement === 'tab');
    expect(tabs.length).toBeGreaterThan(0);
    for (const feature of tabs) {
      const route = jest.requireActual(`../../../app/${feature.audience}/${routeName(feature.id)}`);
      expect({ id: feature.id, hasDefault: typeof route.default }).toEqual({
        id: feature.id,
        hasDefault: 'function',
      });
    }
  });
});
