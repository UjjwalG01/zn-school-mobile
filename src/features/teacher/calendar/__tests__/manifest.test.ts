import { featureRegistry } from '../../../registry';
import { menuHref } from '../../../routes';
import type { VisibilityContext } from '../../../types';
import { isFeatureVisible } from '../../../visibility';
import { TEACHER_CALENDAR_ACCESS } from '../../access';
import { teacherCalendarFeature } from '../manifest';

const ctx = (overrides: Partial<VisibilityContext> = {}): VisibilityContext => ({
  audience: 'teacher',
  permissions: { all: false, keys: ['calendar.read'] },
  licenseModules: ['academic'],
  mobileModules: {},
  ...overrides,
});

describe('teacher.calendar manifest', () => {
  it('is a card in the More hub, not a tab', () => {
    expect(teacherCalendarFeature).toMatchObject({ placement: 'menu', tab: 'teacher.more' });
    expect(featureRegistry).toContain(teacherCalendarFeature);
    expect(menuHref(teacherCalendarFeature)).toBe('/teacher/more/calendar');
  });

  it('is visible with calendar.read, the academic licence and the module on', () => {
    expect(isFeatureVisible(teacherCalendarFeature, ctx())).toBe(true);
    expect(isFeatureVisible(teacherCalendarFeature, ctx({ permissions: { all: true, keys: [] } }))).toBe(true);
  });

  it('is hidden without calendar.read, even for a teacher who can mark attendance and enter marks', () => {
    const others = ctx({ permissions: { all: false, keys: ['attendance.mark', 'exam_result.save', 'exam_attendance.mark'] } });
    expect(isFeatureVisible(teacherCalendarFeature, others)).toBe(false);
  });

  it('is hidden without the academic licence, and when the school switched the calendar off for mobile', () => {
    expect(isFeatureVisible(teacherCalendarFeature, ctx({ licenseModules: ['fees'] }))).toBe(false);
    expect(isFeatureVisible(teacherCalendarFeature, ctx({ mobileModules: { calendar: false } }))).toBe(false);
    expect(isFeatureVisible(teacherCalendarFeature, ctx({ mobileModules: { calendar: true } }))).toBe(true);
  });

  it('is never shown in the guardian shell', () => {
    expect(isFeatureVisible(teacherCalendarFeature, ctx({ audience: 'guardian' }))).toBe(false);
  });

  it('shares one access rule with the constant (one source)', () => {
    expect(teacherCalendarFeature).toMatchObject(TEACHER_CALENDAR_ACCESS);
  });
});
