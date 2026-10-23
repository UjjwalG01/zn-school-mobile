import { featureRegistry } from '../../../registry';
import { routeName } from '../../../routes';
import type { VisibilityContext } from '../../../types';
import { isFeatureVisible } from '../../../visibility';
import { TEACHER_MARKS_ACCESS } from '../../access';
import { teacherMarksFeature } from '../manifest';
import { marksEntryHref } from '../routes';

const ctx = (overrides: Partial<VisibilityContext> = {}): VisibilityContext => ({
  audience: 'teacher',
  permissions: { all: false, keys: ['exam_result.save'] },
  licenseModules: ['academic'],
  mobileModules: {},
  ...overrides,
});

describe('teacher.marks manifest', () => {
  it('is visible to a teacher with exam_result.save, the academic licence and the module on', () => {
    expect(isFeatureVisible(teacherMarksFeature, ctx())).toBe(true);
  });

  it('is visible to an admin who holds every permission', () => {
    expect(isFeatureVisible(teacherMarksFeature, ctx({ permissions: { all: true, keys: [] } }))).toBe(true);
  });

  it('is hidden without exam_result.save, even with attendance and exam read access', () => {
    const readOnly = ctx({ permissions: { all: false, keys: ['attendance.mark', 'exam_result.read'] } });
    expect(isFeatureVisible(teacherMarksFeature, readOnly)).toBe(false);
  });

  it('is hidden when the school has no academic licence', () => {
    expect(isFeatureVisible(teacherMarksFeature, ctx({ licenseModules: ['fees'] }))).toBe(false);
  });

  it('is hidden when the school switched the exams module off for mobile, and shown when no row exists', () => {
    expect(isFeatureVisible(teacherMarksFeature, ctx({ mobileModules: { exams: false } }))).toBe(false);
    expect(isFeatureVisible(teacherMarksFeature, ctx({ mobileModules: { exams: true } }))).toBe(true);
    expect(isFeatureVisible(teacherMarksFeature, ctx({ mobileModules: {} }))).toBe(true);
  });

  it('is not switched off by the attendance module key', () => {
    expect(isFeatureVisible(teacherMarksFeature, ctx({ mobileModules: { attendance: false } }))).toBe(true);
  });

  it('is never shown in the guardian shell', () => {
    expect(isFeatureVisible(teacherMarksFeature, ctx({ audience: 'guardian' }))).toBe(false);
  });

  it('uses the same access rule the Academic hub gates its Marks section on (one source)', () => {
    expect(teacherMarksFeature).toMatchObject(TEACHER_MARKS_ACCESS);
  });

  it('is registered once, inside the Academic tab', () => {
    expect(featureRegistry.filter((feature) => feature.id === 'teacher.marks')).toHaveLength(1);
    expect(teacherMarksFeature).toMatchObject({ placement: 'menu', tab: 'teacher.academic' });
    expect(routeName(teacherMarksFeature.id)).toBe('marks');
  });
});

describe('marksEntryHref', () => {
  it('names the exam, the subject and the section', () => {
    expect(marksEntryHref({ examId: 'x1', examSubjectId: 'es1', sectionId: 's8' })).toBe(
      '/teacher/academic/marks-entry?examId=x1&examSubjectId=es1&sectionId=s8',
    );
  });

  it('leaves the section out for the exam’s own section or a class with none', () => {
    expect(marksEntryHref({ examId: 'x1', examSubjectId: 'es1', sectionId: null })).toBe(
      '/teacher/academic/marks-entry?examId=x1&examSubjectId=es1',
    );
  });

  it('encodes ids so a stray character cannot add a parameter', () => {
    expect(marksEntryHref({ examId: 'a&b=c', examSubjectId: 'es 1', sectionId: null })).toBe(
      '/teacher/academic/marks-entry?examId=a%26b%3Dc&examSubjectId=es%201',
    );
  });
});
