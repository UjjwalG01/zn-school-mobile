import type { VisibilityContext } from '../../../types';
import { isFeatureVisible } from '../../../visibility';
import { TEACHER_ATTENDANCE_ACCESS, TEACHER_STUDENT_INFO_ACCESS } from '../../access';

const ctx = (overrides: Partial<VisibilityContext> = {}): VisibilityContext => ({
  audience: 'teacher',
  permissions: { all: false, keys: ['attendance.mark'] },
  licenseModules: ['academic'],
  mobileModules: {},
  ...overrides,
});

describe('student details access (SI-D1, SI-D4)', () => {
  it('is offered to a teacher with attendance.mark, the academic licence and the students module on or unset', () => {
    expect(isFeatureVisible(TEACHER_STUDENT_INFO_ACCESS, ctx())).toBe(true);
    expect(isFeatureVisible(TEACHER_STUDENT_INFO_ACCESS, ctx({ mobileModules: { students: true } }))).toBe(true);
  });

  it('has its own school switch: turning students off hides it and leaves Attendance alone', () => {
    const off = ctx({ mobileModules: { students: false } });
    expect(isFeatureVisible(TEACHER_STUDENT_INFO_ACCESS, off)).toBe(false);
    expect(isFeatureVisible(TEACHER_ATTENDANCE_ACCESS, off)).toBe(true);
  });

  it('is not switched off by the attendance module key', () => {
    expect(isFeatureVisible(TEACHER_STUDENT_INFO_ACCESS, ctx({ mobileModules: { attendance: false } }))).toBe(true);
  });

  it('needs attendance.mark (a roster-only or marks-only teacher does not get it) and the academic licence', () => {
    expect(isFeatureVisible(TEACHER_STUDENT_INFO_ACCESS, ctx({ permissions: { all: false, keys: ['attendance.read'] } }))).toBe(false);
    expect(isFeatureVisible(TEACHER_STUDENT_INFO_ACCESS, ctx({ permissions: { all: false, keys: ['exam_result.save'] } }))).toBe(false);
    expect(isFeatureVisible(TEACHER_STUDENT_INFO_ACCESS, ctx({ licenseModules: ['fees'] }))).toBe(false);
  });

  it('is visible to an administrator who holds everything, and never in the guardian shell', () => {
    expect(isFeatureVisible(TEACHER_STUDENT_INFO_ACCESS, ctx({ permissions: { all: true, keys: [] } }))).toBe(true);
    expect(isFeatureVisible(TEACHER_STUDENT_INFO_ACCESS, ctx({ audience: 'guardian' }))).toBe(false);
  });
});
