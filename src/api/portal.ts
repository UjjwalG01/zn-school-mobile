// Typed requests for /portal/* (docs/api/API_CONTRACT.md §3; backend ENDPOINTS.md §7e).
// `tenantId` is attached by the client (selected school).
import { apiGet } from './client';
import type { TeacherExam, TeacherMyClasses, TeacherStudent } from './types/portal';

/** One student linked to the caller (`GET /portal/guardian/students`): every link, one row each. Placement is null without an enrollment. */
export interface GuardianStudent {
  studentId: string;
  fullName: string;
  admissionNumber: string;
  status: string;
  relationship: string;
  isPrimary: boolean;
  classId: string | null;
  className: string | null;
  sectionId: string | null;
  sectionName: string | null;
}

/** `GET /portal/guardian/students` — the children linked to the signed-in guardian in the selected school. Needs `portal.student.read`. */
export const getGuardianStudents = () => apiGet<GuardianStudent[]>('/portal/guardian/students');

/** `GET /portal/teacher/my-classes?date=` — class placements + subject assignments. `date` is `YYYY-MM-DD`. */
export const getTeacherMyClasses = (date: string) =>
  apiGet<TeacherMyClasses>(`/portal/teacher/my-classes?date=${encodeURIComponent(date)}`);

/**
 * `GET /portal/teacher/exams` — exams open for marks entry with the caller's subjects and submission
 * state. 403 for an account with no staff link and no `exam_result.save_any`.
 */
export const getTeacherExams = () => apiGet<TeacherExam[]>('/portal/teacher/exams');

/**
 * `GET /portal/teacher/students/:studentId` — one student of a class or section the caller teaches (or
 * any student with `attendance.mark_any`). 403 for any other student, an unlinked account and an id that
 * does not exist (the same answer); 404 only for a `mark_any` holder and a missing id.
 *
 * The response also carries each guardian's e-mail and the class and section ids; they are not kept
 * (STUDENT_INFO_PLAN SI-D2), so they can never reach a cache.
 */
export async function getTeacherStudent(studentId: string): Promise<TeacherStudent> {
  const body = await apiGet<TeacherStudent>(`/portal/teacher/students/${encodeURIComponent(studentId)}`);
  const { student } = body;
  return {
    student: {
      id: student.id,
      admissionNumber: student.admissionNumber,
      fullName: student.fullName,
      dateOfBirth: student.dateOfBirth ?? null,
      gender: student.gender ?? null,
      bloodGroup: student.bloodGroup ?? null,
      status: student.status,
    },
    guardians: body.guardians.map((guardian) => ({
      guardianId: guardian.guardianId,
      fullName: guardian.fullName,
      phone: guardian.phone ?? null,
      relationship: guardian.relationship,
      isPrimary: guardian.isPrimary,
    })),
    enrollments: body.enrollments.map((enrollment) => ({
      id: enrollment.id,
      academicYearLabel: enrollment.academicYearLabel,
      className: enrollment.className,
      sectionName: enrollment.sectionName ?? null,
      status: enrollment.status,
      rollNumber: enrollment.rollNumber ?? null,
    })),
  };
}
