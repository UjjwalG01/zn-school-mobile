// Exam attendance, first screen (teacher.exam-attendance, a card in the Academic hub): the filters, then the paper's sheet.
// The exams listed are the ones the server says this teacher may record (their classes, or every class with
// `exam_attendance.mark_any`); the filters only narrow that list. A section is an optional narrowing of the roster.
import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import type { ExamAttendanceExam } from '../../../api/types/examAttendance';
import { OfflineBanner, savedDataTimestamp } from '../../../components/OfflineBanner';
import { QueryState, queryView } from '../../../components/QueryState';
import { Screen } from '../../../components/Screen';
import { t } from '../../../i18n';
import { type CalendarPreference, formatDate } from '../../../lib/date';
import { useRefreshSchoolsOnFeatureDenied } from '../../featureDenied';
import { useTenantSettings } from '../../queries';
import { useManualRefresh } from '../../useManualRefresh';
import { ExamFilterForm } from '../examFilters/ExamFilterForm';
import type { PickExam } from '../examFilters/examFilterModel';
import { useExamAttendanceExams } from './queries';
import { examAttendanceSheetHref } from './routes';

/** The papers the teacher teaches first, then the rest; each group keeps the server's order. */
const taughtFirst = <T extends { taught: boolean }>(papers: readonly T[]): T[] => [
  ...papers.filter((paper) => paper.taught),
  ...papers.filter((paper) => !paper.taught),
];

/** The server's exam, as the shared filters see it. A paper whose day has not come is listed but not openable. */
function toPickExam(exam: ExamAttendanceExam, calendar: CalendarPreference | undefined): PickExam {
  const dateText = (iso: string | null) => (iso ? (calendar ? formatDate(iso, calendar) : iso) : t('examAttendance.noDate'));
  return {
    examId: exam.examId,
    sessionName: exam.sessionName,
    classId: exam.classId,
    className: exam.className,
    sectionId: exam.sectionId,
    sectionName: exam.sectionName,
    sections: exam.sections.map((section) => ({ id: section.sectionId, name: section.sectionName })),
    items: taughtFirst(exam.papers).map((paper) => ({
      key: paper.examSubjectId,
      examSubjectId: paper.examSubjectId,
      label: paper.subjectName,
      hint: paper.recordable
        ? [dateText(paper.examDate), paper.taught ? t('examAttendance.yourSubject') : null].filter(Boolean).join(' · ')
        : t('examAttendance.opensOn', { date: dateText(paper.examDate) }),
      sectionId: null,
      blocked: !paper.recordable,
      note: null,
    })),
  };
}

export default function ExamAttendanceListScreen() {
  const router = useRouter();
  const query = useExamAttendanceExams();
  const calendar = useTenantSettings().data?.calendarPreference;
  useRefreshSchoolsOnFeatureDenied(query.error);
  const { refreshing, onRefresh } = useManualRefresh(() => query.refetch());
  const exams = useMemo(() => (query.data ?? []).map((exam) => toPickExam(exam, calendar)), [query.data, calendar]);
  const empty = query.data?.length === 0;

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <OfflineBanner asOf={savedDataTimestamp([query])} />
      <QueryState query={query} isEmpty={empty} emptyText={t('examAttendance.listEmpty')}>
        {queryView(query) === 'content' ? (
          <ExamFilterForm
            exams={exams}
            itemLabel={t('filter.paper')}
            openLabel={t('examAttendance.open')}
            onOpen={({ exam, item, sectionId, sectionName }) =>
              router.push(
                examAttendanceSheetHref({
                  examId: exam.examId,
                  examSubjectId: item.examSubjectId,
                  // A section exam is already one section; only a whole-class exam is narrowed by the choice.
                  sectionId: exam.sectionId === null ? sectionId : null,
                  sectionName: exam.sectionId === null ? sectionName : null,
                }),
              )
            }
          />
        ) : null}
      </QueryState>
    </Screen>
  );
}
