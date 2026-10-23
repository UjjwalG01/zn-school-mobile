import type { TeacherMyClasses } from '../../../../api/types/portal';
import { buildAssignmentSections } from '../assignmentsModel';

const data = (overrides: Partial<TeacherMyClasses> = {}): TeacherMyClasses => ({
  restricted: true,
  classes: [],
  subjects: [],
  ...overrides,
});

describe('buildAssignmentSections', () => {
  it('lists every class and subject in the backend order, labelled by class and section', () => {
    const [classes, subjects] = buildAssignmentSections(
      data({
        classes: [
          { classId: 'c10', className: 'Class 10', sectionId: 's1', sectionName: 'A' },
          { classId: 'c2', className: 'Class 2', sectionId: 's2', sectionName: 'B' },
        ],
        subjects: [
          {
            classId: 'c10',
            className: 'Class 10',
            sectionId: 's1',
            sectionName: 'A',
            subjectOfferingId: 'o1',
            subjectName: 'Science',
          },
        ],
      }),
    );
    expect(classes).toMatchObject({ id: 'classes', title: 'assignments.classes' });
    expect(classes!.data).toEqual([
      { key: 'c10:s1', text: 'Class 10 · A' }, // not re-sorted: a string sort would put Class 10 first anyway
      { key: 'c2:s2', text: 'Class 2 · B' },
    ]);
    expect(subjects).toMatchObject({ id: 'subjects', title: 'assignments.subjects' });
    expect(subjects!.data).toEqual([{ key: 'o1:s1', text: 'Science — Class 10 · A' }]);
  });

  it('labels a class with no sections without a section and keys it as "none"', () => {
    const [classes, subjects] = buildAssignmentSections(
      data({
        classes: [{ classId: 'c6', className: 'Class 6', sectionId: null, sectionName: null }],
        subjects: [
          {
            classId: 'c6',
            className: 'Class 6',
            sectionId: null,
            sectionName: null,
            subjectOfferingId: 'o9',
            subjectName: 'Art',
          },
        ],
      }),
    );
    expect(classes!.data).toEqual([{ key: 'c6:none', text: 'Class 6' }]);
    expect(subjects!.data).toEqual([{ key: 'o9:none', text: 'Art — Class 6' }]);
  });

  it('keeps both sections when empty, each with its empty-state text key', () => {
    const [classes, subjects] = buildAssignmentSections(data());
    expect(classes).toMatchObject({ data: [], emptyText: 'home.noClasses' });
    expect(subjects).toMatchObject({ data: [], emptyText: 'home.noSubjects' });
  });

  it('gives every row a unique key', () => {
    const [classes] = buildAssignmentSections(
      data({
        classes: [
          { classId: 'c8', className: 'Class 8', sectionId: 's1', sectionName: 'A' },
          { classId: 'c8', className: 'Class 8', sectionId: 's2', sectionName: 'B' },
        ],
      }),
    );
    expect(new Set(classes!.data.map((row) => row.key)).size).toBe(2);
  });
});
