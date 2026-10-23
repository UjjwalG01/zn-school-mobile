import type { TeacherStudentEnrollment } from '../../../../api/types/portal';
import { setLocale } from '../../../../i18n';
import { dialable, genderText, relationshipText, splitEnrollments, statusText, statusTone } from '../studentModel';
import { studentHref } from '../routes';

const enrollment = (id: string, status: string): TeacherStudentEnrollment => ({
  id,
  academicYearLabel: id,
  className: 'Grade 1',
  sectionName: 'A',
  status,
  rollNumber: '1',
});

describe('words for API values', () => {
  beforeEach(() => setLocale('en'));
  afterEach(() => setLocale('en'));

  it('names the known student and enrollment statuses', () => {
    expect(statusText('active')).toBe('Active');
    expect(statusText('transferred_out')).toBe('Transferred out');
    expect(statusText('promoted')).toBe('Promoted');
    expect(statusText('withdrawn')).toBe('Withdrawn');
  });

  it('names gender and relationship, and shows a value the app does not know as returned', () => {
    expect(genderText('female')).toBe('Female');
    expect(relationshipText('mother')).toBe('Mother');
    expect(statusText('on_leave')).toBe('on_leave');
    expect(genderText('x')).toBe('x');
    expect(relationshipText('uncle')).toBe('uncle');
  });

  it('follows the app language', () => {
    setLocale('ne');
    expect(statusText('active')).toBe('सक्रिय');
    expect(relationshipText('father')).toBe('बुबा');
  });

  it('shows only an active student as a success badge', () => {
    expect(statusTone('active')).toBe('success');
    expect(statusTone('withdrawn')).toBe('neutral');
    expect(statusTone('something_new')).toBe('neutral');
  });
});

describe('splitEnrollments', () => {
  it('puts the active enrollment first and keeps the others in the order returned', () => {
    const { current, earlier } = splitEnrollments([enrollment('2081', 'promoted'), enrollment('2082', 'active'), enrollment('2080', 'promoted')]);
    expect(current?.id).toBe('2082');
    expect(earlier.map((e) => e.id)).toEqual(['2081', '2080']);
  });

  it('falls back to the first returned when none is active, and handles none', () => {
    expect(splitEnrollments([enrollment('a', 'graduated'), enrollment('b', 'promoted')]).current?.id).toBe('a');
    expect(splitEnrollments([])).toEqual({ current: null, earlier: [] });
  });
});

describe('dialable', () => {
  it('keeps digits and a leading plus only', () => {
    expect(dialable('+977 980-000 0000')).toBe('+9779800000000');
    expect(dialable('(01) 4412345')).toBe('014412345');
  });
});

describe('studentHref', () => {
  it('names the student inside the Attendance stack and encodes the id', () => {
    expect(studentHref('abc')).toBe('/teacher/attendance/student?studentId=abc');
    expect(studentHref('a&b')).toBe('/teacher/attendance/student?studentId=a%26b');
  });
});
