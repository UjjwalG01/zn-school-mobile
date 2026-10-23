import type { Href } from 'expo-router';

import type { SlotRef } from './marksModel';

/**
 * The entry screen for one subject of one section. A cast string, like `menuHref`: a brand-new
 * route is not in the typed-routes file until the owner's Metro regenerates it (plan §11.4).
 * `sectionId` is left out for the exam's own section or a class with no sections.
 */
export const marksEntryHref = ({ examId, examSubjectId, sectionId }: SlotRef): Href => {
  const query = [`examId=${encodeURIComponent(examId)}`, `examSubjectId=${encodeURIComponent(examSubjectId)}`];
  if (sectionId) query.push(`sectionId=${encodeURIComponent(sectionId)}`);
  return `/teacher/academic/marks-entry?${query.join('&')}` as Href;
};
