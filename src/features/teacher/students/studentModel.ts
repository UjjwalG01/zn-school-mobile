// Presentation helpers for the student-details screen. The words for the API's status, gender and
// relationship values are the app's own strings; a value the app does not know yet is shown as
// returned, never hidden or guessed (STUDENT_INFO_PLAN §3.2).
import type { TeacherStudentEnrollment } from '../../../api/types/portal';
import type { BadgeTone } from '../../../components/StatusBadge';
import { type MessageKey, t } from '../../../i18n';

// Student statuses: active | inactive | graduated | transferred_out | withdrawn.
// Enrollment statuses: active | promoted | graduated | transferred | withdrawn.
const STATUS: Readonly<Record<string, MessageKey>> = {
  active: 'studentInfo.status.active',
  inactive: 'studentInfo.status.inactive',
  graduated: 'studentInfo.status.graduated',
  transferred_out: 'studentInfo.status.transferred_out',
  transferred: 'studentInfo.status.transferred',
  promoted: 'studentInfo.status.promoted',
  withdrawn: 'studentInfo.status.withdrawn',
};
const GENDER: Readonly<Record<string, MessageKey>> = {
  male: 'studentInfo.gender.male',
  female: 'studentInfo.gender.female',
  other: 'studentInfo.gender.other',
};
const RELATIONSHIP: Readonly<Record<string, MessageKey>> = {
  father: 'studentInfo.relationship.father',
  mother: 'studentInfo.relationship.mother',
  guardian: 'studentInfo.relationship.guardian',
  other: 'studentInfo.relationship.other',
};

const word = (words: Readonly<Record<string, MessageKey>>, value: string) => {
  const key = words[value];
  return key ? t(key) : value;
};

export const statusText = (value: string) => word(STATUS, value);
export const genderText = (value: string) => word(GENDER, value);
export const relationshipText = (value: string) => word(RELATIONSHIP, value);
export const statusTone = (value: string): BadgeTone => (value === 'active' ? 'success' : 'neutral');

/** The enrollment shown first (the active one, else the first returned) and the earlier ones in the order returned. */
export function splitEnrollments(enrollments: readonly TeacherStudentEnrollment[]): {
  current: TeacherStudentEnrollment | null;
  earlier: TeacherStudentEnrollment[];
} {
  const current = enrollments.find((enrollment) => enrollment.status === 'active') ?? enrollments[0] ?? null;
  return { current, earlier: enrollments.filter((enrollment) => enrollment !== current) };
}

/** Digits and a leading `+` only, for a `tel:` link; the number itself is shown exactly as the school typed it. */
export const dialable = (phone: string): string => phone.replace(/[^\d+]/g, '');
