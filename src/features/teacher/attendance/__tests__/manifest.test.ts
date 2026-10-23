import type { VisibilityContext } from '../../../types';
import { featureRegistry } from '../../../registry';
import { isFeatureVisible, visibleFeatures } from '../../../visibility';
import { routeName } from '../../../routes';
import { TEACHER_ATTENDANCE_ACCESS } from '../../access';
import { teacherAttendanceFeature } from '../manifest';

const ctx = (overrides: Partial<VisibilityContext> = {}): VisibilityContext => ({
  audience: 'teacher',
  permissions: { all: false, keys: ['attendance.mark'] },
  licenseModules: ['academic'],
  mobileModules: {},
  ...overrides,
});

describe('teacher.attendance manifest', () => {
  it('is visible to a teacher with attendance.mark, the academic licence and the module on', () => {
    expect(isFeatureVisible(teacherAttendanceFeature, ctx())).toBe(true);
  });

  it('is visible to an admin who holds every permission', () => {
    expect(isFeatureVisible(teacherAttendanceFeature, ctx({ permissions: { all: true, keys: [] } }))).toBe(true);
  });

  it('is hidden without attendance.mark', () => {
    expect(isFeatureVisible(teacherAttendanceFeature, ctx({ permissions: { all: false, keys: ['attendance.read'] } }))).toBe(false);
  });

  it('is hidden when the school has no academic licence', () => {
    expect(isFeatureVisible(teacherAttendanceFeature, ctx({ licenseModules: ['fees'] }))).toBe(false);
  });

  it('is hidden when the school switched the attendance module off for mobile, and shown when no row exists', () => {
    expect(isFeatureVisible(teacherAttendanceFeature, ctx({ mobileModules: { attendance: false } }))).toBe(false);
    expect(isFeatureVisible(teacherAttendanceFeature, ctx({ mobileModules: {} }))).toBe(true);
  });

  it('is never shown in the guardian shell', () => {
    expect(isFeatureVisible(teacherAttendanceFeature, ctx({ audience: 'guardian' }))).toBe(false);
  });

  it('uses the same access rule Home gates its Attendance block on (one source)', () => {
    expect(teacherAttendanceFeature).toMatchObject(TEACHER_ATTENDANCE_ACCESS);
  });

  it('is a tab whose route is the directory `attendance`, with its own header', () => {
    expect(routeName(teacherAttendanceFeature.id)).toBe('attendance');
    expect(teacherAttendanceFeature).toMatchObject({ placement: 'tab', stack: true });
  });

  it('sits second, and the registry lists its features in `order`', () => {
    expect(featureRegistry.map((f) => f.id)).toEqual([
      'teacher.home',
      'teacher.attendance',
      'teacher.selfAttendance',
      'teacher.academic',
      'teacher.assignments',
      'teacher.marks',
      'teacher.exam-attendance',
      'teacher.more',
      'teacher.calendar',
      'teacher.profile',
    ]);
    const orders = featureRegistry.map((f) => f.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    // With attendance.mark only, everything but My Attendance (attendance.self), Marks entry (exam_result.save),
    // Exam attendance (exam_attendance.mark) and the Calendar (calendar.read) is visible.
    const needsAnotherKey = ['teacher.selfAttendance', 'teacher.marks', 'teacher.exam-attendance', 'teacher.calendar'];
    expect(visibleFeatures(featureRegistry, ctx()).map((f) => f.id)).toEqual(
      featureRegistry.map((f) => f.id).filter((id) => !needsAnotherKey.includes(id)),
    );
  });
});

describe('teacher.selfAttendance manifest', () => {
  const self = featureRegistry.find((f) => f.id === 'teacher.selfAttendance')!;

  it('is a subtab of the Attendance tab, not a tab', () => {
    expect(self).toMatchObject({ placement: 'menu', tab: 'teacher.attendance' });
  });

  it('needs attendance.self, the academic licence and the attendance module', () => {
    const withSelf = ctx({ permissions: { all: false, keys: ['attendance.self'] } });
    expect(isFeatureVisible(self, withSelf)).toBe(true);
    expect(isFeatureVisible(self, ctx())).toBe(false);
    expect(isFeatureVisible(self, { ...withSelf, licenseModules: [] })).toBe(false);
    expect(isFeatureVisible(self, { ...withSelf, mobileModules: { attendance: false } })).toBe(false);
  });
});
