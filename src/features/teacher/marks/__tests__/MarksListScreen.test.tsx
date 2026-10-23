import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ApiError, NETWORK_ERROR_CODE } from '../../../../api/errors';
import { getTeacherExams } from '../../../../api/portal';
import { getTenantSettings } from '../../../../api/settings';
import { getMySchools } from '../../../../api/tenancy';
import type { TeacherExam, TeacherExamSubject } from '../../../../api/types/portal';
import { resetSessionForTests, selectTenant } from '../../../../auth/session';
import { tenantSettingsKey } from '../../../queries';
import { teacherExamsKey } from '../../queries';
import MarksListScreen from '../MarksListScreen';
import { marksEntryHref } from '../routes';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../../../../api/portal');
jest.mock('../../../../api/settings');
jest.mock('../../../../api/tenancy');

const subject = (
  id: string,
  name: string,
  sectionName: string | null,
  submission: TeacherExamSubject['submission'] = null,
): TeacherExamSubject => ({
  examSubjectId: id,
  subjectName: name,
  sectionId: sectionName ? `sec-${sectionName}` : null,
  sectionName,
  components: [],
  submission,
});

const EXAMS: TeacherExam[] = [
  {
    examId: 'x8',
    name: 'Second Terminal',
    sessionName: '2083',
    classId: 'c8',
    className: 'Class 8',
    sectionId: 'sec-A',
    sectionName: 'A',
    subjects: [
      subject('es-math', 'Mathematics', 'A'),
      subject('es-sci', 'Science', 'A', { status: 'draft', version: 1, returnedReason: null, submittedAt: null }),
    ],
  },
  {
    examId: 'x6',
    name: 'First Terminal',
    sessionName: '2083',
    classId: 'c6',
    className: 'Class 6',
    sectionId: null,
    sectionName: null,
    subjects: [
      subject('es-eng', 'English', null, { status: 'submitted', version: 2, returnedReason: null, submittedAt: '2026-10-20T10:00:00Z' }),
      subject('es-nep', 'Nepali', null, { status: 'returned', version: 4, returnedReason: 'Recheck Anil Rai', submittedAt: '2026-10-19T10:00:00Z' }),
    ],
  },
  {
    // One exam for every section of the class; the subject is listed once per section.
    examId: 'x9',
    name: 'Unit Test',
    sessionName: '2083',
    classId: 'c9',
    className: 'Class 9',
    sectionId: null,
    sectionName: null,
    subjects: [subject('es-soc', 'Social', 'A'), subject('es-soc', 'Social', 'B')],
  },
  {
    examId: 'x7',
    name: 'Mid Term',
    sessionName: '2082',
    classId: 'c7',
    className: 'Class 7',
    sectionId: null,
    sectionName: null,
    subjects: [subject('es-art', 'Art', null)],
  },
];

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeEach(() => {
  resetSessionForTests();
  selectTenant('t1');
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  jest.mocked(getTeacherExams).mockResolvedValue(EXAMS);
  jest.mocked(getMySchools).mockResolvedValue([]);
  jest.mocked(getTenantSettings).mockResolvedValue({ calendarPreference: 'gregorian' });
});

afterEach(() => {
  client.clear();
  jest.clearAllMocks();
});

/** Opens a filter and picks one of its choices, the way a teacher does. */
async function choose(user: ReturnType<typeof userEvent.setup>, field: string, option: string) {
  await user.press(await screen.findByRole('button', { name: new RegExp(`^${field}:`) }));
  await user.press(await screen.findByRole('radio', { name: new RegExp(`^${option}`) }));
}

describe('Marks entry filters', () => {
  it('starts with the session, class and subject filters and nothing opened', async () => {
    await render(<MarksListScreen />, { wrapper });

    expect(await screen.findByRole('button', { name: /^Exam session:/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Class:/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Subject:/ })).toBeTruthy();
    expect(screen.getByText('Choose an exam session first')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('opens the entry screen of the chosen subject, with where each submission stands', async () => {
    await render(<MarksListScreen />, { wrapper });
    const user = userEvent.setup();

    await choose(user, 'Exam session', '2083');
    await choose(user, 'Class', 'Class 8');
    await user.press(await screen.findByRole('button', { name: /^Subject:/ }));
    expect(await screen.findByRole('radio', { name: 'Mathematics, Not started' })).toBeTruthy();
    await user.press(screen.getByRole('radio', { name: 'Science, Draft' }));
    await user.press(screen.getByRole('button', { name: 'Open marks entry' }));

    expect(mockPush).toHaveBeenLastCalledWith(
      marksEntryHref({ examId: 'x8', examSubjectId: 'es-sci', sectionId: 'sec-A' }),
    );
  });

  it('leaves out the section for a class that has none', async () => {
    await render(<MarksListScreen />, { wrapper });
    const user = userEvent.setup();

    await choose(user, 'Exam session', '2083');
    await choose(user, 'Class', 'Class 6');
    await choose(user, 'Subject', 'English');
    await user.press(screen.getByRole('button', { name: 'Open marks entry' }));

    expect(mockPush).toHaveBeenLastCalledWith(marksEntryHref({ examId: 'x6', examSubjectId: 'es-eng', sectionId: null }));
  });

  it('shows the school’s reason once a returned subject is chosen, and for no other', async () => {
    await render(<MarksListScreen />, { wrapper });
    const user = userEvent.setup();

    await choose(user, 'Exam session', '2083');
    await choose(user, 'Class', 'Class 6');
    await choose(user, 'Subject', 'English');
    expect(screen.queryByText(/Returned by the school/)).toBeNull();
    await choose(user, 'Subject', 'Nepali');
    expect(screen.getByText('Returned by the school: Recheck Anil Rai')).toBeTruthy();
  });

  it('offers a section for a whole-class exam and narrows the subjects to it', async () => {
    await render(<MarksListScreen />, { wrapper });
    const user = userEvent.setup();

    await choose(user, 'Exam session', '2083');
    await choose(user, 'Class', 'Class 9');
    // Optional: with no section chosen, the subject appears once per section.
    await user.press(await screen.findByRole('button', { name: /^Subject:/ }));
    expect(await screen.findByRole('radio', { name: /^Social · A/ })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /^Social · B/ })).toBeTruthy();
    await user.press(screen.getByRole('button', { name: 'Close' }));

    await choose(user, 'Section \\(optional\\)', 'B');
    await user.press(await screen.findByRole('button', { name: /^Subject:/ }));
    expect(screen.queryByRole('radio', { name: /^Social · A/ })).toBeNull();
    await user.press(screen.getByRole('radio', { name: /^Social · B/ }));
    await user.press(screen.getByRole('button', { name: 'Open marks entry' }));
    expect(mockPush).toHaveBeenLastCalledWith(marksEntryHref({ examId: 'x9', examSubjectId: 'es-soc', sectionId: 'sec-B' }));
  });

  it('drops the class and subject when the session changes, and offers only that session’s classes', async () => {
    await render(<MarksListScreen />, { wrapper });
    const user = userEvent.setup();

    await choose(user, 'Exam session', '2083');
    await choose(user, 'Class', 'Class 8');
    await choose(user, 'Exam session', '2082');
    await user.press(screen.getByRole('button', { name: /^Class:/ }));
    expect(await screen.findByRole('radio', { name: 'Class 7' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Class 8' })).toBeNull();
  });

  it('chooses the only session and the only class for the teacher', async () => {
    jest.mocked(getTeacherExams).mockResolvedValue([EXAMS[3]!]);
    await render(<MarksListScreen />, { wrapper });

    expect(await screen.findByRole('button', { name: 'Exam session: 2082' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Class: Class 7' })).toBeTruthy();
  });

  it('shows the empty state when no exam is open for this teacher', async () => {
    jest.mocked(getTeacherExams).mockResolvedValue([]);
    await render(<MarksListScreen />, { wrapper });

    expect(await screen.findByText('No exams are open for marks entry.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Open marks entry' })).toBeNull();
  });

  it('says there is no access on a 403', async () => {
    jest.mocked(getTeacherExams).mockRejectedValue(new ApiError(403, 'Not linked to a staff member'));
    await render(<MarksListScreen />, { wrapper });

    await waitFor(() => expect(screen.getByText("You don't have access to this section.")).toBeTruthy());
  });

  it('makes no request when Home or the Academic hub already loaded the exams', async () => {
    client.setQueryData(teacherExamsKey('t1'), EXAMS);
    await render(<MarksListScreen />, { wrapper });

    expect(screen.getByRole('button', { name: /^Class:/ })).toBeTruthy();
    expect(getTeacherExams).not.toHaveBeenCalled();
  });

  it('keeps the cached filters and says it is saved data when a refresh fails offline', async () => {
    client.setQueryData(tenantSettingsKey('t1'), { calendarPreference: 'gregorian' });
    client.setQueryData(teacherExamsKey('t1'), EXAMS, { updatedAt: Date.now() - 60 * 60 * 1000 });
    jest.mocked(getTeacherExams).mockRejectedValue(new ApiError(0, 'offline', NETWORK_ERROR_CODE));
    await render(<MarksListScreen />, { wrapper });

    await waitFor(() => expect(screen.getByText(/Showing saved data from/)).toBeTruthy());
    expect(screen.getByRole('button', { name: /^Class:/ })).toBeTruthy();
  });
});
