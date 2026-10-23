import { featureRegistry } from '../../../registry';
import { menuHref } from '../../../routes';
import type { VisibilityContext } from '../../../types';
import { isFeatureVisible } from '../../../visibility';
import { TEACHER_EXAM_ATTENDANCE_ACCESS } from '../../access';
import { teacherExamAttendanceFeature } from '../manifest';
import { examAttendanceSheetHref } from '../routes';

const ctx = (overrides: Partial<VisibilityContext> = {}): VisibilityContext => ({
  audience: 'teacher',
  permissions: { all: false, keys: ['exam_attendance.mark'] },
  licenseModules: ['academic'],
  mobileModules: {},
  ...overrides,
});

describe('teacher.exam-attendance manifest', () => {
  it('is a card in the Academic hub, not a tab', () => {
    expect(teacherExamAttendanceFeature).toMatchObject({ placement: 'menu', tab: 'teacher.academic' });
    expect(featureRegistry).toContain(teacherExamAttendanceFeature);
    expect(menuHref(teacherExamAttendanceFeature)).toBe('/teacher/academic/exam-attendance');
  });

  it('is visible with exam_attendance.mark, the academic licence and the module on', () => {
    expect(isFeatureVisible(teacherExamAttendanceFeature, ctx())).toBe(true);
    expect(isFeatureVisible(teacherExamAttendanceFeature, ctx({ permissions: { all: true, keys: [] } }))).toBe(true);
  });

  it('is hidden without exam_attendance.mark: marking attendance or entering marks does not open it', () => {
    const others = ctx({ permissions: { all: false, keys: ['attendance.mark', 'exam_result.save', 'calendar.read'] } });
    expect(isFeatureVisible(teacherExamAttendanceFeature, others)).toBe(false);
  });

  it('does not read exam_attendance.mark_any: the broader permission cannot be what makes the card appear', () => {
    const anyOnly = ctx({ permissions: { all: false, keys: ['exam_attendance.mark_any'] } });
    expect(isFeatureVisible(teacherExamAttendanceFeature, anyOnly)).toBe(false);
  });

  it('follows the exams switch of the school, and the academic licence', () => {
    expect(isFeatureVisible(teacherExamAttendanceFeature, ctx({ mobileModules: { exams: false } }))).toBe(false);
    expect(isFeatureVisible(teacherExamAttendanceFeature, ctx({ licenseModules: ['fees'] }))).toBe(false);
  });

  it('is never shown in the guardian shell', () => {
    expect(isFeatureVisible(teacherExamAttendanceFeature, ctx({ audience: 'guardian' }))).toBe(false);
  });

  it('shares one access rule with the constant (one source)', () => {
    expect(teacherExamAttendanceFeature).toMatchObject(TEACHER_EXAM_ATTENDANCE_ACCESS);
  });
});

describe('examAttendanceSheetHref', () => {
  it('names the paper, and the section only when the roster is narrowed to one', () => {
    expect(examAttendanceSheetHref({ examId: 'x1', examSubjectId: 'p1', sectionId: null, sectionName: null })).toBe(
      '/teacher/academic/exam-attendance-sheet?examId=x1&examSubjectId=p1',
    );
    expect(examAttendanceSheetHref({ examId: 'x1', examSubjectId: 'p1', sectionId: 's 2', sectionName: 'B & C' })).toBe(
      '/teacher/academic/exam-attendance-sheet?examId=x1&examSubjectId=p1&sectionId=s%202&sectionName=B%20%26%20C',
    );
  });
});
