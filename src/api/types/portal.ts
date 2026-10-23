// Hand-written from the backend ENDPOINTS.md §7e (A6). Only fields the app uses.
// `maxMarks` is a decimal string per the backend code ("100.00"); confirm on a live response.

export interface TeacherPlacement {
  classId: string;
  className: string;
  /** null = a class with no sections (ADR-0054). Confirm sectionName is null too on a live response. */
  sectionId: string | null;
  sectionName: string | null;
}

export interface TeacherSubjectAssignment extends TeacherPlacement {
  subjectOfferingId: string;
  subjectName: string;
}

/** `GET /portal/teacher/my-classes?date=` */
export interface TeacherMyClasses {
  /** false = holds attendance.mark_any: `classes` is every active section. */
  restricted: boolean;
  classes: TeacherPlacement[];
  subjects: TeacherSubjectAssignment[];
}

export type SubmissionStatus = 'draft' | 'submitted' | 'returned';

export interface MarksSubmission {
  status: SubmissionStatus;
  version: number;
  returnedReason: string | null;
  submittedAt: string | null;
}

/** One mark the teacher enters for a subject. */
export interface ExamComponent {
  id: string;
  name: string;
  /** Decimal string; the largest mark the backend accepts for this component. */
  maxMarks: string;
}

export interface TeacherExamSubject {
  examSubjectId: string;
  subjectName: string;
  sectionId: string | null;
  sectionName: string | null;
  components: ExamComponent[];
  /** null = nothing saved yet. */
  submission: MarksSubmission | null;
}

/** One row of `GET /portal/teacher/exams` — an exam open for marks entry. */
export interface TeacherExam {
  examId: string;
  name: string;
  sessionName: string;
  /** The class the exam is for; the filters group exams by it. */
  classId: string;
  className: string;
  sectionId: string | null;
  sectionName: string | null;
  subjects: TeacherExamSubject[];
}

// `GET /portal/teacher/students/:studentId` (backend ENDPOINTS.md §7e), confirmed on a live response
// 2026-10-22. Only the fields the profile screen shows are kept (docs/project/STUDENT_INFO_PLAN.md §3.2):
// the guardians' e-mail and the class and section ids are dropped on purpose (SI-D2).

export interface TeacherStudentGuardian {
  guardianId: string;
  fullName: string;
  /** As typed by the school (for example "9800000000"); null when none is on record. */
  phone: string | null;
  /** `father | mother | guardian | other`; shown as returned if a new value appears. */
  relationship: string;
  isPrimary: boolean;
}

export interface TeacherStudentEnrollment {
  id: string;
  academicYearLabel: string;
  className: string;
  /** null = a class with no sections. */
  sectionName: string | null;
  /** `active | promoted | graduated | transferred | withdrawn`. */
  status: string;
  rollNumber: string | null;
}

export interface TeacherStudent {
  student: {
    id: string;
    admissionNumber: string;
    fullName: string;
    /** AD `YYYY-MM-DD`. */
    dateOfBirth: string | null;
    /** `male | female | other`, or null. */
    gender: string | null;
    bloodGroup: string | null;
    /** `active | inactive | graduated | transferred_out | withdrawn`. */
    status: string;
  };
  guardians: TeacherStudentGuardian[];
  enrollments: TeacherStudentEnrollment[];
}
