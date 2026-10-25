import { featureRegistry } from '../../../registry';
import { menuHref } from '../../../routes';
import type { VisibilityContext } from '../../../types';
import { isFeatureVisible } from '../../../visibility';
import { teacherNotificationsFeature } from '../manifest';
import { NOTIFICATIONS_HREF } from '../routes';

const ctx = (overrides: Partial<VisibilityContext> = {}): VisibilityContext => ({
  audience: 'teacher',
  permissions: { all: false, keys: [] },
  licenseModules: [],
  mobileModules: {},
  ...overrides,
});

describe('teacher.notifications manifest', () => {
  it('is a card in the More hub and the target of the header bell', () => {
    expect(teacherNotificationsFeature).toMatchObject({ placement: 'menu', tab: 'teacher.more' });
    expect(featureRegistry).toContain(teacherNotificationsFeature);
    expect(NOTIFICATIONS_HREF).toBe(menuHref(teacherNotificationsFeature));
    expect(NOTIFICATIONS_HREF).toBe('/teacher/more/notifications');
  });

  it('needs no permission or licence (the inbox is membership-only), but is never shown in the guardian shell', () => {
    expect(isFeatureVisible(teacherNotificationsFeature, ctx())).toBe(true);
    expect(isFeatureVisible(teacherNotificationsFeature, ctx({ audience: 'guardian' }))).toBe(false);
  });
});
