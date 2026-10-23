// Pure view-model for My classes: the full `my-classes` response as list sections, in the
// backend's order (no re-sorting: a string sort would put "Class 10" before "Class 2").
import type { TeacherMyClasses } from '../../../api/types/portal';
import type { MessageKey } from '../../../i18n';
import { placementLabel } from '../placement';

export interface AssignmentRow {
  key: string;
  text: string;
}

export interface AssignmentSection {
  id: 'classes' | 'subjects';
  title: MessageKey;
  emptyText: MessageKey;
  data: AssignmentRow[];
}

const idPart = (id: string | null) => id ?? 'none';

/** Both sections are always returned; an empty one carries its empty-state text. */
export function buildAssignmentSections(data: TeacherMyClasses): AssignmentSection[] {
  return [
    {
      id: 'classes',
      title: 'assignments.classes',
      emptyText: 'home.noClasses',
      data: data.classes.map((placement) => ({
        key: `${placement.classId}:${idPart(placement.sectionId)}`,
        text: placementLabel(placement),
      })),
    },
    {
      id: 'subjects',
      title: 'assignments.subjects',
      emptyText: 'home.noSubjects',
      data: data.subjects.map((subject) => ({
        key: `${subject.subjectOfferingId}:${idPart(subject.sectionId)}`,
        text: `${subject.subjectName} — ${placementLabel(subject)}`,
      })),
    },
  ];
}
