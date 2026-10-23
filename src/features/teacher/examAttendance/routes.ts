import type { Href } from 'expo-router';

export interface SheetTarget {
  examId: string;
  examSubjectId: string;
  /** The section the roster is narrowed to; left out for "all my sections", a section exam and a class with none. */
  sectionId: string | null;
  /** Display only (the header says which section the list is narrowed to). Nothing is decided from it. */
  sectionName: string | null;
}

/**
 * The attendance sheet for one paper. A cast string, like `marksEntryHref`: a brand-new route is not in the typed-routes
 * file until Metro regenerates it.
 */
export const examAttendanceSheetHref = ({ examId, examSubjectId, sectionId, sectionName }: SheetTarget): Href => {
  const query = [`examId=${encodeURIComponent(examId)}`, `examSubjectId=${encodeURIComponent(examSubjectId)}`];
  if (sectionId) query.push(`sectionId=${encodeURIComponent(sectionId)}`);
  if (sectionId && sectionName) query.push(`sectionName=${encodeURIComponent(sectionName)}`);
  return `/teacher/academic/exam-attendance-sheet?${query.join('&')}` as Href;
};
