import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ApiError } from '../../../../api/errors';
import { getExamAttendanceExams } from '../../../../api/examAttendance';
import { getTenantSettings } from '../../../../api/settings';
import { getMySchools } from '../../../../api/tenancy';
import type { ExamAttendanceExam } from '../../../../api/types/examAttendance';
import { resetSessionForTests, selectTenant } from '../../../../auth/session';
import ExamAttendanceListScreen from '../ExamAttendanceListScreen';
import { examAttendanceSheetHref } from '../routes';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../../../../api/examAttendance');
jest.mock('../../../../api/settings');
jest.mock('../../../../api/tenancy');

const paper = (id: string, name: string, extra: Partial<ExamAttendanceExam['papers'][number]> = {}) => ({
  examSubjectId: id,
  subjectName: name,
  examDate: '2026-10-20',
  recordable: true,
  taught: false,
  ...extra,
});

const EXAMS: ExamAttendanceExam[] = [
  {
    // One exam for every section of Class 5; the teacher is assigned to A and B.
    examId: 'x5',
    name: 'Terminal',
    sessionName: '2083',
    classId: 'c5',
    className: 'Class 5',
    sectionId: null,
    sectionName: null,
    sections: [
      { sectionId: 'sa', sectionName: 'A' },
      { sectionId: 'sb', sectionName: 'B' },
    ],
    papers: [
      paper('p-eng', 'English'),
      paper('p-math', 'Mathematics', { taught: true }),
      paper('p-sci', 'Science', { examDate: '2026-11-30', recordable: false }),
    ],
  },
  {
    // A class with no sections.
    examId: 'x1',
    name: 'Terminal',
    sessionName: '2083',
    classId: 'c1',
    className: 'Nursery',
    sectionId: null,
    sectionName: null,
    sections: [],
    papers: [paper('p-rhy', 'Rhymes', { examDate: null })],
  },
  {
    // A section exam: the section is fixed.
    examId: 'x7a',
    name: 'Terminal',
    sessionName: '2083',
    classId: 'c7',
    className: 'Class 7',
    sectionId: 'sec7a',
    sectionName: 'A',
    sections: [],
    papers: [paper('p-art', 'Art')],
  },
];

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

async function choose(user: ReturnType<typeof userEvent.setup>, field: string, option: string | RegExp) {
  await user.press(await screen.findByRole('button', { name: new RegExp(`^${field}:`) }));
  await user.press(await screen.findByRole('radio', { name: option }));
}

beforeEach(() => {
  resetSessionForTests();
  selectTenant('t1');
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  jest.mocked(getExamAttendanceExams).mockResolvedValue(EXAMS);
  jest.mocked(getMySchools).mockResolvedValue([]);
  jest.mocked(getTenantSettings).mockResolvedValue({ calendarPreference: 'gregorian' });
});

afterEach(() => {
  client.clear();
  jest.clearAllMocks();
});

describe('Exam attendance filters', () => {
  it('walks session → class → paper and opens the sheet for the whole class when no section is chosen', async () => {
    await render(<ExamAttendanceListScreen />, { wrapper });
    const user = userEvent.setup();

    await choose(user, 'Class', 'Class 5');
    // Papers the teacher teaches come first, with the date; one whose day has not come says when it opens.
    await user.press(await screen.findByRole('button', { name: /^Paper:/ }));
    const names = (await screen.findAllByRole('radio')).map((node) => node.props.accessibilityLabel as string);
    expect(names).toEqual([
      'Mathematics, 2026-10-20 · Your subject',
      'English, 2026-10-20',
      'Science, Opens on 2026-11-30',
    ]);
    await user.press(screen.getByRole('radio', { name: /^Mathematics/ }));
    await user.press(screen.getByRole('button', { name: 'Open attendance' }));

    expect(mockPush).toHaveBeenLastCalledWith(
      examAttendanceSheetHref({ examId: 'x5', examSubjectId: 'p-math', sectionId: null, sectionName: null }),
    );
  });

  it('narrows the roster to a section when one is chosen, and the choice is optional', async () => {
    await render(<ExamAttendanceListScreen />, { wrapper });
    const user = userEvent.setup();

    await choose(user, 'Class', 'Class 5');
    await choose(user, 'Section \\(optional\\)', 'B');
    await choose(user, 'Paper', /^English/);
    await user.press(screen.getByRole('button', { name: 'Open attendance' }));
    expect(mockPush).toHaveBeenLastCalledWith(
      examAttendanceSheetHref({ examId: 'x5', examSubjectId: 'p-eng', sectionId: 'sb', sectionName: 'B' }),
    );

    // Clearing it goes back to every section the teacher may record.
    await choose(user, 'Section \\(optional\\)', 'All my sections');
    expect(screen.getByRole('button', { name: 'Section (optional): Choose' })).toBeTruthy();
  });

  it('shows no section filter for a class with none, and sends no section', async () => {
    await render(<ExamAttendanceListScreen />, { wrapper });
    const user = userEvent.setup();

    await choose(user, 'Class', 'Nursery');
    expect(screen.queryByRole('button', { name: /^Section/ })).toBeNull();
    await choose(user, 'Paper', /^Rhymes/);
    await user.press(screen.getByRole('button', { name: 'Open attendance' }));

    expect(mockPush).toHaveBeenLastCalledWith(
      examAttendanceSheetHref({ examId: 'x1', examSubjectId: 'p-rhy', sectionId: null, sectionName: null }),
    );
  });

  it('treats a section exam as already one section: no section filter, none sent', async () => {
    await render(<ExamAttendanceListScreen />, { wrapper });
    const user = userEvent.setup();

    await choose(user, 'Class', 'Class 7');
    expect(screen.queryByRole('button', { name: /^Section/ })).toBeNull();
    await choose(user, 'Paper', /^Art/);
    await user.press(screen.getByRole('button', { name: 'Open attendance' }));

    expect(mockPush).toHaveBeenLastCalledWith(
      examAttendanceSheetHref({ examId: 'x7a', examSubjectId: 'p-art', sectionId: null, sectionName: null }),
    );
  });

  it('does not open a paper whose day has not come, and says when it opens', async () => {
    await render(<ExamAttendanceListScreen />, { wrapper });
    const user = userEvent.setup();

    await choose(user, 'Class', 'Class 5');
    await choose(user, 'Paper', /^Science/);

    expect(screen.getByText('Opens on 2026-11-30')).toBeTruthy();
    await user.press(screen.getByRole('button', { name: 'Open attendance' }));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('keeps the button off until a paper is chosen', async () => {
    await render(<ExamAttendanceListScreen />, { wrapper });
    const user = userEvent.setup();

    await user.press(await screen.findByRole('button', { name: 'Open attendance' }));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows the empty state when no exam is open for the teacher’s classes', async () => {
    jest.mocked(getExamAttendanceExams).mockResolvedValue([]);
    await render(<ExamAttendanceListScreen />, { wrapper });

    expect(await screen.findByText('No exam is open for attendance in your classes.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Open attendance' })).toBeNull();
  });

  it('says there is no access on a 403', async () => {
    jest.mocked(getExamAttendanceExams).mockRejectedValue(new ApiError(403, 'Not linked to a staff member'));
    await render(<ExamAttendanceListScreen />, { wrapper });

    await waitFor(() => expect(screen.getByText("You don't have access to this section.")).toBeTruthy());
  });
});
