// Marks entry, first screen (teacher.marks, a card in the Academic hub): the filters — exam session, class, section,
// subject — then the entry screen of the chosen subject. The exams are the ones the backend lists as open for marks entry
// on this teacher's subjects, with where each submission stands (docs/project/MARKS_PLAN.md §5; the filter step is the
// owner's 2026-10-23 request that every exam workflow on the phone filters the way the web does).
import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import type { TeacherExam } from '../../../api/types/portal';
import { OfflineBanner, savedDataTimestamp } from '../../../components/OfflineBanner';
import { QueryState, queryView } from '../../../components/QueryState';
import { Screen } from '../../../components/Screen';
import { t } from '../../../i18n';
import { useRefreshSchoolsOnFeatureDenied } from '../../featureDenied';
import { useManualRefresh } from '../../useManualRefresh';
import { ExamFilterForm } from '../examFilters/ExamFilterForm';
import type { PickExam } from '../examFilters/examFilterModel';
import { subjectProgress } from '../home/homeModel';
import { useTeacherExams } from '../queries';
import { marksEntryHref } from './routes';

/** The backend's exam, as the shared filters see it: one item per subject (and section, for a whole-class exam). */
function toPickExam(exam: TeacherExam): PickExam {
  const wholeClass = exam.sectionId === null;
  const sections = new Map<string, string>();
  if (wholeClass) {
    for (const subject of exam.subjects) {
      if (subject.sectionId && subject.sectionName) sections.set(subject.sectionId, subject.sectionName);
    }
  }
  return {
    examId: exam.examId,
    sessionName: exam.sessionName,
    classId: exam.classId,
    className: exam.className,
    sectionId: exam.sectionId,
    sectionName: exam.sectionName,
    sections: [...sections].map(([id, name]) => ({ id, name })),
    items: exam.subjects.map((subject) => {
      const progress = subjectProgress(subject.submission);
      return {
        key: `${subject.examSubjectId}:${subject.sectionId ?? 'none'}`,
        examSubjectId: subject.examSubjectId,
        label: wholeClass && subject.sectionName ? `${subject.subjectName} · ${subject.sectionName}` : subject.subjectName,
        hint: t(`home.progress.${progress}`),
        sectionId: subject.sectionId,
        blocked: false,
        note:
          progress === 'returned' && subject.submission?.returnedReason
            ? t('marks.returnedBanner', { reason: subject.submission.returnedReason })
            : null,
      };
    }),
  };
}

export default function MarksListScreen() {
  const router = useRouter();
  const query = useTeacherExams();
  useRefreshSchoolsOnFeatureDenied(query.error);
  const { refreshing, onRefresh } = useManualRefresh(() => query.refetch());
  const exams = useMemo(() => (query.data ?? []).map(toPickExam), [query.data]);

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <OfflineBanner asOf={savedDataTimestamp([query])} />
      <QueryState query={query} isEmpty={query.data?.length === 0} emptyText={t('home.noExams')}>
        {queryView(query) === 'content' ? (
          <ExamFilterForm
            exams={exams}
            itemLabel={t('filter.subject')}
            openLabel={t('marks.openEntry')}
            onOpen={({ item, exam }) =>
              router.push(marksEntryHref({ examId: exam.examId, examSubjectId: item.examSubjectId, sectionId: item.sectionId }))
            }
          />
        ) : null}
      </QueryState>
    </Screen>
  );
}
