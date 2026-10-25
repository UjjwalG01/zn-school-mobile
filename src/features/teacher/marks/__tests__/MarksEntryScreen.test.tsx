import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Alert } from 'react-native';

import { getExamResults, getExamRoster, postBulkMarks, submitSubjectMarks } from '../../../../api/academic';
import { ApiError, NETWORK_ERROR_CODE } from '../../../../api/errors';
import { getTeacherExams } from '../../../../api/portal';
import type { ExamResult, ExamRosterRow } from '../../../../api/types/academic';
import type { ExamComponent, TeacherExam, TeacherExamSubject } from '../../../../api/types/portal';
import { resetSessionForTests, selectTenant } from '../../../../auth/session';
import { getToast, resetToastForTests } from '../../../../lib/toast';
import { teacherExamsKey } from '../../queries';
import MarksEntryScreen from '../MarksEntryScreen';

let mockParams: Record<string, string | undefined> = {};
const mockTitle = jest.fn();
const mockAddListener = jest.fn();
jest.mock('expo-router', () => ({
  Stack: {
    Screen: ({ options }: { options: { title?: string } }) => {
      mockTitle(options.title);
      return null;
    },
  },
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({ addListener: mockAddListener, dispatch: jest.fn() }),
}));
jest.mock('../../../../api/academic');
jest.mock('../../../../api/portal');
jest.mock('../../../../api/settings');
jest.mock('../../../../api/tenancy');

const THEORY: ExamComponent = { id: 'c-th', name: 'Theory', maxMarks: '80.00' };
const PRACTICAL: ExamComponent = { id: 'c-pr', name: 'Practical', maxMarks: '20.00' };

const student = (id: string, fullName: string): ExamRosterRow => ({
  enrollmentId: `e-${id}`,
  fullName,
  admissionNumber: `ADM-${id}`,
  rollNumber: null,
});
const ROSTER = [student('anil', 'Anil Rai'), student('bina', 'Bina Thapa'), student('chandra', 'Chandra Karki')];

const result = (id: string, version: number, theory: string, practical: string): ExamResult => ({
  id: `r-${id}`,
  enrollmentId: `e-${id}`,
  version,
  components: [
    { examComponentId: THEORY.id, obtainedMarks: theory },
    { examComponentId: PRACTICAL.id, obtainedMarks: practical },
  ],
});
// Only Bina has marks saved (version 3).
const RESULTS = [result('bina', 3, '75.00', '18.50')];
const ALL_RESULTS = [result('anil', 1, '70.00', '15.00'), result('bina', 3, '75.00', '18.50'), result('chandra', 2, '60.00', '12.00')];

const subject = (submission: TeacherExamSubject['submission'] = null): TeacherExamSubject => ({
  examSubjectId: 'es1',
  subjectName: 'Mathematics',
  sectionId: 's8',
  sectionName: 'A',
  components: [THEORY, PRACTICAL],
  submission,
});
const exams = (submission: TeacherExamSubject['submission'] = null): TeacherExam[] => [
  {
    examId: 'x1',
    name: 'Second Terminal',
    sessionName: '2083',
    classId: 'c-class-8',
    className: 'Class 8',
    sectionId: 's8',
    sectionName: 'A',
    subjects: [subject(submission)],
  },
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

const field = (name: string, component: ExamComponent) =>
  screen.getByLabelText(`${name}: ${component.name} (out of ${Number(component.maxMarks)})`);
const saveButton = (count: number, options: { disabled?: boolean } = {}) =>
  screen.getByRole('button', { name: `Save marks (${count})`, ...options });
const submitButton = (options: { disabled?: boolean } = {}) =>
  screen.getByRole('button', { name: 'Submit to school', ...options });

async function openEntry() {
  await render(<MarksEntryScreen />, { wrapper });
  await screen.findByText('Anil Rai');
}

/** Types into one field the way a teacher does, one key at a time. */
async function enter(name: string, component: ExamComponent, text: string) {
  await userEvent.setup().type(field(name, component), text);
}

beforeEach(() => {
  resetSessionForTests();
  resetToastForTests();
  selectTenant('t1');
  mockParams = { examId: 'x1', examSubjectId: 'es1', sectionId: 's8' };
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
  jest.mocked(getTeacherExams).mockResolvedValue(exams());
  jest.mocked(getExamRoster).mockResolvedValue(ROSTER);
  jest.mocked(getExamResults).mockResolvedValue(RESULTS);
  jest.mocked(postBulkMarks).mockResolvedValue({ ok: true, replayed: false, results: [] });
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(async () => {
  // Queries the test did not wait for must settle, and their 0 ms notify timer must fire, inside act.
  await waitFor(() => expect(client.isFetching() + client.isMutating()).toBe(0));
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
  client.clear();
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

describe('opening a subject', () => {
  it('asks for the exam students and results, titles the screen with the subject and shows the saved marks', async () => {
    await openEntry();

    expect(getExamRoster).toHaveBeenCalledWith({ examId: 'x1', sectionId: 's8' });
    expect(getExamResults).toHaveBeenCalledWith('x1');
    await waitFor(() => expect(mockTitle).toHaveBeenLastCalledWith('Mathematics'));
    // Exam, class, subject and session are said once, in the summary above the table.
    expect(screen.getByText('Second Terminal')).toBeTruthy();
    expect(screen.getByText('Class 8 · A')).toBeTruthy();
    expect(screen.getByText('Mathematics')).toBeTruthy();
    expect(screen.getByText('2083')).toBeTruthy();
    // Bina's marks are saved: shown without trailing zeros; the others are empty.
    expect(field('Bina Thapa', THEORY).props.value).toBe('75');
    expect(field('Bina Thapa', PRACTICAL).props.value).toBe('18.5');
    expect(field('Anil Rai', THEORY).props.value).toBe('');
    expect(screen.getByText('1 of 3 students complete')).toBeTruthy();
  });

  it('leaves the section out for an exam with none', async () => {
    mockParams = { examId: 'x1', examSubjectId: 'es1' };
    jest.mocked(getTeacherExams).mockResolvedValue([
      { ...exams()[0]!, sectionId: null, sectionName: null, subjects: [{ ...subject(), sectionId: null, sectionName: null }] },
    ]);

    await openEntry();

    expect(getExamRoster).toHaveBeenCalledWith({ examId: 'x1', sectionId: null });
  });

  it('says the subject is no longer open when the exam list does not hold it, and asks for nothing else', async () => {
    jest.mocked(getTeacherExams).mockResolvedValue([]);
    await render(<MarksEntryScreen />, { wrapper });

    expect(await screen.findByText('This subject is no longer open for marks entry. Go back and choose another.')).toBeTruthy();
    expect(getExamRoster).not.toHaveBeenCalled();
    expect(getExamResults).not.toHaveBeenCalled();
  });

  it('says there is no access when the students are forbidden', async () => {
    jest.mocked(getExamRoster).mockRejectedValue(new ApiError(403, 'Forbidden'));
    await render(<MarksEntryScreen />, { wrapper });

    await waitFor(() => expect(screen.getByText("You don't have access to this section.")).toBeTruthy());
  });

  it('shows a message when no students need marks', async () => {
    jest.mocked(getExamRoster).mockResolvedValue([]);
    await render(<MarksEntryScreen />, { wrapper });

    expect(await screen.findByText('No students need marks for this exam.')).toBeTruthy();
  });
});

describe('entering and saving', () => {
  it('sends only the changed, complete students in one request, with every component and the version seen', async () => {
    await openEntry();
    const user = userEvent.setup();
    await enter('Anil Rai', THEORY, '70');
    await enter('Anil Rai', PRACTICAL, '15');
    await enter('Bina Thapa', THEORY, '0'); // appended to the saved "75": becomes 750, above the maximum
    await user.clear(field('Bina Thapa', THEORY));
    await enter('Bina Thapa', THEORY, '60'); // Bina's practical stays at the saved 18.5

    await user.press(saveButton(2));

    await waitFor(() => expect(postBulkMarks).toHaveBeenCalledTimes(1));
    const body = jest.mocked(postBulkMarks).mock.calls[0]![0];
    expect(body.idempotencyKey).toMatch(UUID);
    expect(body.examId).toBe('x1');
    expect(body.items).toEqual([
      {
        enrollmentId: 'e-anil',
        components: [
          { examComponentId: THEORY.id, obtainedMarks: 70 },
          { examComponentId: PRACTICAL.id, obtainedMarks: 15 },
        ],
        version: 0,
      },
      {
        enrollmentId: 'e-bina',
        components: [
          { examComponentId: THEORY.id, obtainedMarks: 60 },
          { examComponentId: PRACTICAL.id, obtainedMarks: 18.5 },
        ],
        version: 3, // M-D1: the version the teacher saw
      },
    ]);
  });

  it('confirms with a toast, clears the edits and patches the cached results without refetching them', async () => {
    jest.mocked(postBulkMarks).mockResolvedValue({
      ok: true,
      replayed: false,
      results: [result('anil', 1, '70', '15')],
    });
    await openEntry();
    const user = userEvent.setup();
    await enter('Anil Rai', THEORY, '70');
    await enter('Anil Rai', PRACTICAL, '15');

    await user.press(saveButton(1));

    await waitFor(() => expect(getToast()).toMatchObject({ message: 'Marks saved', tone: 'success' }));
    expect(screen.getByRole('button', { name: 'Save marks (0)', disabled: true })).toBeTruthy();
    expect(screen.getByText('2 of 3 students complete')).toBeTruthy();
    expect(getExamResults).toHaveBeenCalledTimes(1);
  });

  it('does not send a partly filled student and says what is missing', async () => {
    await openEntry();
    await enter('Anil Rai', THEORY, '70');

    expect(saveButton(0, { disabled: true })).toBeTruthy();
    expect(screen.getByText('Enter every mark for this student')).toBeTruthy();
    expect(screen.getByText('Enter every mark for a student before saving that student')).toBeTruthy();
    expect(postBulkMarks).not.toHaveBeenCalled();
  });

  it('flags a mark above the component maximum and does not send it', async () => {
    await openEntry();
    await enter('Anil Rai', THEORY, '95');
    await enter('Anil Rai', PRACTICAL, '15');

    expect(screen.getByText('Must be between 0 and 80')).toBeTruthy();
    expect(saveButton(0, { disabled: true })).toBeTruthy();
  });

  it('flags text that is not a number', async () => {
    await openEntry();
    await enter('Anil Rai', THEORY, 'abc');

    expect(screen.getByText('Enter a number, for example 72.5')).toBeTruthy();
  });

  it('shows the backend reason on each refused student and keeps what was typed', async () => {
    jest.mocked(postBulkMarks).mockResolvedValue({
      ok: false,
      failures: [{ identifier: { enrollmentId: 'e-anil' }, error: 'Student is not eligible for this exam' }],
    });
    await openEntry();
    const user = userEvent.setup();
    await enter('Anil Rai', THEORY, '70');
    await enter('Anil Rai', PRACTICAL, '15');

    await user.press(saveButton(1));

    expect(await screen.findByText('Student is not eligible for this exam')).toBeTruthy();
    expect(screen.getByText('Nothing was saved. Check the students below and save again.')).toBeTruthy();
    expect(field('Anil Rai', THEORY).props.value).toBe('70');
    expect(saveButton(1)).toBeTruthy(); // still a change: the teacher can fix and save again
  });

  it('sends one request for a double tap', async () => {
    let resolve!: (value: Awaited<ReturnType<typeof postBulkMarks>>) => void;
    jest.mocked(postBulkMarks).mockReturnValue(new Promise((r) => (resolve = r)));
    await openEntry();
    const user = userEvent.setup();
    await enter('Anil Rai', THEORY, '70');
    await enter('Anil Rai', PRACTICAL, '15');

    await user.press(saveButton(1));
    await user.press(saveButton(1));

    expect(postBulkMarks).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ ok: true, replayed: false, results: [] }));
  });

  it('keeps the edits and says so when the device is offline', async () => {
    jest.mocked(postBulkMarks).mockRejectedValue(new ApiError(0, 'offline', NETWORK_ERROR_CODE));
    await openEntry();
    const user = userEvent.setup();
    await enter('Anil Rai', THEORY, '70');
    await enter('Anil Rai', PRACTICAL, '15');

    await user.press(saveButton(1));

    expect(await screen.findByText('No connection. Your changes are kept. Save again when you are online.')).toBeTruthy();
    expect(field('Anil Rai', THEORY).props.value).toBe('70');
  });

  it('says the teacher cannot enter this subject on a plain 403', async () => {
    jest.mocked(postBulkMarks).mockRejectedValue(new ApiError(403, 'Forbidden'));
    await openEntry();
    const user = userEvent.setup();
    await enter('Anil Rai', THEORY, '70');
    await enter('Anil Rai', PRACTICAL, '15');

    await user.press(saveButton(1));

    expect(await screen.findByText("You can't enter marks for this subject.")).toBeTruthy();
  });

  it('asks before leaving with unsaved marks, and not when there is nothing unsaved', async () => {
    await openEntry();
    expect(mockAddListener).not.toHaveBeenCalled();

    await enter('Anil Rai', THEORY, '70');

    await waitFor(() => expect(mockAddListener).toHaveBeenCalledWith('beforeRemove', expect.any(Function)));
  });
});

describe('a version conflict', () => {
  it('refetches, flags the student, and lets the teacher keep their marks', async () => {
    // Someone saved another subject for Bina meanwhile: her version moved to 4, the maths marks are the same.
    jest.mocked(getExamResults)
      .mockResolvedValueOnce(RESULTS)
      .mockResolvedValue([result('bina', 4, '75.00', '18.50')]);
    jest.mocked(postBulkMarks).mockRejectedValue(new ApiError(409, 'stale', 'CONCURRENCY_VERSION_CONFLICT'));
    await openEntry();
    const user = userEvent.setup();
    await user.clear(field('Bina Thapa', THEORY));
    await enter('Bina Thapa', THEORY, '60');

    await user.press(saveButton(1));

    expect(
      await screen.findByText(
        'Marks for this subject were changed at the same time. Your changes are kept. Check the highlighted students and save again.',
      ),
    ).toBeTruthy();
    expect(await screen.findByText('These marks were changed by someone else. Keep yours or use the saved marks.')).toBeTruthy();
    expect(getExamResults).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Resolve the highlighted students first')).toBeTruthy();
    expect(saveButton(1, { disabled: true })).toBeTruthy();

    await user.press(screen.getByRole('button', { name: 'Keep mine' }));
    await user.press(saveButton(1));

    await waitFor(() => expect(postBulkMarks).toHaveBeenCalledTimes(2));
    expect(jest.mocked(postBulkMarks).mock.calls[1]![0].items[0]).toMatchObject({ enrollmentId: 'e-bina', version: 4 });
  });

  it('use theirs drops the teacher’s edit and shows the saved marks', async () => {
    jest.mocked(getExamResults)
      .mockResolvedValueOnce(RESULTS)
      .mockResolvedValue([result('bina', 4, '80.00', '18.50')]);
    jest.mocked(postBulkMarks).mockRejectedValue(new ApiError(409, 'stale', 'CONCURRENCY_VERSION_CONFLICT'));
    await openEntry();
    const user = userEvent.setup();
    await user.clear(field('Bina Thapa', THEORY));
    await enter('Bina Thapa', THEORY, '60');
    await user.press(saveButton(1));
    await screen.findByText('These marks were changed by someone else. Keep yours or use the saved marks.');

    await user.press(screen.getByRole('button', { name: 'Use theirs' }));

    expect(field('Bina Thapa', THEORY).props.value).toBe('80');
    expect(saveButton(0, { disabled: true })).toBeTruthy();
  });
});

describe('submitting a subject', () => {
  it('is offered only when every student is complete and nothing is unsaved', async () => {
    await openEntry();

    expect(submitButton({ disabled: true })).toBeTruthy();
    expect(screen.getByText('Enter and save marks for every student to submit')).toBeTruthy();

    await enter('Anil Rai', THEORY, '70');
    expect(screen.getByText('Enter every mark for a student before saving that student')).toBeTruthy();
  });

  it('asks first, then sends the section and the submission version, and turns read-only', async () => {
    jest.mocked(getExamResults).mockResolvedValue(ALL_RESULTS);
    jest.mocked(getTeacherExams).mockResolvedValue(exams({ status: 'draft', version: 2, returnedReason: null, submittedAt: null }));
    jest.mocked(submitSubjectMarks).mockResolvedValue({
      id: 'sub1',
      examSubjectId: 'es1',
      sectionId: 's8',
      status: 'submitted',
      returnedReason: null,
      submittedAt: '2026-10-22T10:00:00Z',
      version: 3,
    });
    await openEntry();
    const user = userEvent.setup();
    await waitFor(() => expect(submitButton({ disabled: false })).toBeTruthy());

    await user.press(submitButton());

    // The native confirm is shown first; nothing is sent until the teacher accepts it.
    expect(submitSubjectMarks).not.toHaveBeenCalled();
    const [title, , buttons] = jest.mocked(Alert.alert).mock.calls[0]!;
    expect(title).toBe('Submit marks?');
    await act(async () => buttons!.find((button) => button.text === 'Submit to school')!.onPress!());

    await waitFor(() => expect(submitSubjectMarks).toHaveBeenCalledWith('x1', 'es1', { sectionId: 's8', version: 2 }));
    await waitFor(() => expect(getToast()).toMatchObject({ message: 'Marks submitted', tone: 'success' }));
    expect(screen.getByText('Submitted to the school. The school can return them if changes are needed.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Submit to school' })).toBeNull();
    expect(client.getQueryData<TeacherExam[]>(teacherExamsKey('t1'))![0]!.subjects[0]!.submission).toMatchObject({
      status: 'submitted',
      version: 3,
    });
  });

  it('does not submit when the teacher cancels the confirm', async () => {
    jest.mocked(getExamResults).mockResolvedValue(ALL_RESULTS);
    await openEntry();
    const user = userEvent.setup();
    await waitFor(() => expect(submitButton({ disabled: false })).toBeTruthy());

    await user.press(submitButton());
    const [, , buttons] = jest.mocked(Alert.alert).mock.calls[0]!;
    expect(buttons!.find((button) => button.style === 'cancel')).toBeTruthy();

    expect(submitSubjectMarks).not.toHaveBeenCalled();
  });

  it('shows the missing-marks message when the backend says the subject is incomplete', async () => {
    jest.mocked(getExamResults).mockResolvedValue(ALL_RESULTS);
    jest.mocked(submitSubjectMarks).mockRejectedValue(new ApiError(400, 'missing', 'EXAM_MARKS_INCOMPLETE'));
    await openEntry();
    const user = userEvent.setup();
    await waitFor(() => expect(submitButton({ disabled: false })).toBeTruthy());

    await user.press(submitButton());
    const [, , buttons] = jest.mocked(Alert.alert).mock.calls[0]!;
    await act(async () => buttons!.find((button) => button.text === 'Submit to school')!.onPress!());

    expect(await screen.findByText('Some students are missing marks. Check them, save, and submit again.')).toBeTruthy();
  });
});

describe('the subject state', () => {
  it('shows a submitted subject read-only, with an explanation and no buttons', async () => {
    jest.mocked(getTeacherExams).mockResolvedValue(
      exams({ status: 'submitted', version: 2, returnedReason: null, submittedAt: '2026-10-22T10:00:00Z' }),
    );
    await openEntry();

    expect(screen.getByText('Submitted to the school. The school can return them if changes are needed.')).toBeTruthy();
    expect(field('Bina Thapa', THEORY).props.editable).toBe(false);
    expect(screen.queryByRole('button', { name: /Save marks/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Submit to school' })).toBeNull();
  });

  it('shows the school’s reason for a returned subject and keeps it editable', async () => {
    jest.mocked(getTeacherExams).mockResolvedValue(
      exams({ status: 'returned', version: 4, returnedReason: 'Recheck Anil Rai', submittedAt: null }),
    );
    await openEntry();

    expect(screen.getByText('Returned by the school: Recheck Anil Rai')).toBeTruthy();
    expect(field('Anil Rai', THEORY).props.editable).not.toBe(false);
    expect(saveButton(0)).toBeTruthy();
  });

  it('turns read-only when a save answers that the subject was already submitted', async () => {
    jest.mocked(postBulkMarks).mockRejectedValue(new ApiError(409, 'submitted', 'EXAM_MARKS_SUBMITTED'));
    jest.mocked(getTeacherExams)
      .mockResolvedValueOnce(exams())
      .mockResolvedValue(exams({ status: 'submitted', version: 2, returnedReason: null, submittedAt: 't' }));
    await openEntry();
    const user = userEvent.setup();
    await enter('Anil Rai', THEORY, '70');
    await enter('Anil Rai', PRACTICAL, '15');

    await user.press(saveButton(1));

    expect(await screen.findByText('Submitted to the school. The school can return them if changes are needed.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Save marks/ })).toBeNull();
  });
});

describe('retries, stale submissions and returned subjects', () => {
  const SUBMITTED_ROW = {
    id: 'sub1',
    examSubjectId: 'es1',
    sectionId: 's8',
    status: 'submitted' as const,
    returnedReason: null,
    submittedAt: '2026-10-22T10:00:00Z',
    version: 5,
  };

  /** Presses Submit and accepts the native confirm, the way a teacher does. */
  async function submitAndConfirm() {
    const user = userEvent.setup();
    await waitFor(() => expect(submitButton({ disabled: false })).toBeTruthy());
    await user.press(submitButton());
    const [, , buttons] = jest.mocked(Alert.alert).mock.calls[0]!;
    await act(async () => buttons!.find((button) => button.text === 'Submit to school')!.onPress!());
  }

  it('retries an offline save with the same idempotency key and payload', async () => {
    jest.mocked(postBulkMarks).mockRejectedValueOnce(new ApiError(0, 'offline', NETWORK_ERROR_CODE));
    await openEntry();
    const user = userEvent.setup();
    await enter('Anil Rai', THEORY, '70');
    await enter('Anil Rai', PRACTICAL, '15');

    await user.press(saveButton(1));
    await screen.findByText('No connection. Your changes are kept. Save again when you are online.');
    await user.press(saveButton(1)); // the teacher presses Save again; nothing was edited

    await waitFor(() => expect(postBulkMarks).toHaveBeenCalledTimes(2));
    const [first, second] = jest.mocked(postBulkMarks).mock.calls.map(([body]) => body);
    expect(second!.idempotencyKey).toMatch(UUID);
    expect(second!.idempotencyKey).toBe(first!.idempotencyKey);
    expect(second!.items).toEqual(first!.items);
  });

  it('gives an edited payload a new key after a failed attempt', async () => {
    jest.mocked(postBulkMarks).mockRejectedValueOnce(new ApiError(0, 'offline', NETWORK_ERROR_CODE));
    await openEntry();
    const user = userEvent.setup();
    await enter('Anil Rai', THEORY, '70');
    await enter('Anil Rai', PRACTICAL, '15');
    await user.press(saveButton(1));
    await screen.findByText('No connection. Your changes are kept. Save again when you are online.');

    await user.clear(field('Anil Rai', PRACTICAL));
    await enter('Anil Rai', PRACTICAL, '16');
    await user.press(saveButton(1));

    await waitFor(() => expect(postBulkMarks).toHaveBeenCalledTimes(2));
    const [first, second] = jest.mocked(postBulkMarks).mock.calls.map(([body]) => body);
    expect(second!.idempotencyKey).not.toBe(first!.idempotencyKey);
  });

  it('words a stale submission differently from a save conflict, and refreshes the list and the marks', async () => {
    jest.mocked(getExamResults).mockResolvedValue(ALL_RESULTS);
    jest.mocked(getTeacherExams).mockResolvedValue(exams({ status: 'draft', version: 1, returnedReason: null, submittedAt: null }));
    jest
      .mocked(submitSubjectMarks)
      .mockRejectedValue(new ApiError(409, 'This submission changed since you loaded it; reload and retry', 'CONCURRENCY_VERSION_CONFLICT'));
    await openEntry();

    await submitAndConfirm();

    expect(
      await screen.findByText('The submission changed since you opened this screen. It has been refreshed. Check it and submit again.'),
    ).toBeTruthy();
    expect(screen.queryByText(/highlighted students/)).toBeNull();
    await waitFor(() => expect(getTeacherExams).toHaveBeenCalledTimes(2));
    expect(getExamResults).toHaveBeenCalledTimes(2);
  });

  it('says the teacher cannot enter this subject when the submit is refused with a plain 403', async () => {
    jest.mocked(getExamResults).mockResolvedValue(ALL_RESULTS);
    jest.mocked(submitSubjectMarks).mockRejectedValue(new ApiError(403, 'You are not assigned as the subject teacher'));
    await openEntry();

    await submitAndConfirm();

    expect(await screen.findByText("You can't enter marks for this subject.")).toBeTruthy();
  });

  it('lets a returned subject be corrected and submitted again with the returned submission version', async () => {
    jest.mocked(getExamResults).mockResolvedValue(ALL_RESULTS);
    jest
      .mocked(getTeacherExams)
      .mockResolvedValue(exams({ status: 'returned', version: 4, returnedReason: 'Recheck Anil Rai', submittedAt: 't' }));
    jest.mocked(submitSubjectMarks).mockResolvedValue(SUBMITTED_ROW);
    await openEntry();
    expect(screen.getByText('Returned by the school: Recheck Anil Rai')).toBeTruthy();

    await submitAndConfirm();

    await waitFor(() => expect(submitSubjectMarks).toHaveBeenCalledWith('x1', 'es1', { sectionId: 's8', version: 4 }));
    expect(await screen.findByText('Submitted to the school. The school can return them if changes are needed.')).toBeTruthy();
  });

  it('keeps the save disabled and the leave guard on while a student is only partly filled', async () => {
    await openEntry();

    await enter('Anil Rai', THEORY, '70');

    expect(saveButton(0, { disabled: true })).toBeTruthy();
    expect(submitButton({ disabled: true })).toBeTruthy();
    await waitFor(() => expect(mockAddListener).toHaveBeenCalledWith('beforeRemove', expect.any(Function)));
  });

  it('names the failing student on a refused save, and clears the reasons on the next attempt', async () => {
    jest
      .mocked(postBulkMarks)
      .mockResolvedValueOnce({
        ok: false,
        failures: [{ identifier: { enrollmentId: 'e-anil' }, error: 'obtainedMarks for "Mathematics - Theory" must be between 0 and 80' }],
      })
      .mockResolvedValue({ ok: true, replayed: false, results: [result('anil', 1, '70.00', '15.00')] });
    await openEntry();
    const user = userEvent.setup();
    await enter('Anil Rai', THEORY, '70');
    await enter('Anil Rai', PRACTICAL, '15');

    await user.press(saveButton(1));
    expect(await screen.findByText('obtainedMarks for "Mathematics - Theory" must be between 0 and 80')).toBeTruthy();

    await user.press(saveButton(1));
    await waitFor(() => expect(screen.queryByText(/must be between 0 and 80/)).toBeNull());
    expect(await screen.findByText('2 of 3 students complete')).toBeTruthy();
  });
});

describe('the table', () => {
  const withRolls = (rolls: (string | null)[]): ExamRosterRow[] =>
    ROSTER.map((row, index) => ({ ...row, rollNumber: rolls[index] ?? null }));

  it('lists one row per student, sorted by roll number (2 before 10, no roll last)', async () => {
    jest.mocked(getExamRoster).mockResolvedValue(withRolls(['10', null, '2']));
    await openEntry();

    const order = screen.getAllByLabelText(/: Theory \(out of 80\)$/).map((node) => node.props.accessibilityLabel.split(':')[0]);
    expect(order).toEqual(['Chandra Karki', 'Anil Rai', 'Bina Thapa']);
    // The roll is its own column: shown beside the name, a dash for a student without one.
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.getByText('–')).toBeTruthy();
  });

  it('names each column and its maximum once, in the header, not in every row', async () => {
    await openEntry();

    expect(screen.getAllByText('Theory')).toHaveLength(1);
    expect(screen.getAllByText('/ 80')).toHaveLength(1);
    expect(screen.getAllByText('Practical')).toHaveLength(1);
    expect(screen.getAllByText('/ 20')).toHaveLength(1);
    expect(screen.getByText('Roll')).toBeTruthy();
    expect(screen.getByText('Student')).toBeTruthy();
  });

  it('counts unsaved students beside the progress line, and clears it once they are saved', async () => {
    jest.mocked(postBulkMarks).mockResolvedValue({ ok: true, replayed: false, results: [result('anil', 1, '70', '15')] });
    await openEntry();
    const user = userEvent.setup();
    expect(screen.queryByText(/^Unsaved:/)).toBeNull();

    await enter('Anil Rai', THEORY, '70');
    expect(screen.getByText('Unsaved: 1')).toBeTruthy();

    await enter('Anil Rai', PRACTICAL, '15');
    await user.press(saveButton(1));
    await waitFor(() => expect(screen.queryByText(/^Unsaved:/)).toBeNull());
  });

  it('locks the boxes while a save is in flight', async () => {
    let finish: (value: { ok: true; replayed: false; results: ExamResult[] }) => void = () => undefined;
    jest.mocked(postBulkMarks).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    await openEntry();
    const user = userEvent.setup();
    await enter('Anil Rai', THEORY, '70');
    await enter('Anil Rai', PRACTICAL, '15');

    await user.press(saveButton(1));
    await waitFor(() => expect(field('Anil Rai', THEORY).props.editable).toBe(false));

    await act(async () => finish({ ok: true, replayed: false, results: [result('anil', 1, '70', '15')] }));
    await waitFor(() => expect(field('Anil Rai', THEORY).props.editable).toBe(true));
  });

  describe('when the backend says what kind of mark each component is', () => {
    const open = async (components: ExamComponent[]) => {
      const list = exams();
      list[0]!.subjects[0]!.components = components;
      jest.mocked(getTeacherExams).mockResolvedValue(list);
      await openEntry();
    };
    const THEORY_T: ExamComponent = { ...THEORY, componentType: 'theory' };
    const PRACTICAL_T: ExamComponent = { ...PRACTICAL, componentType: 'practical' };

    it('puts Theory before Practical whatever order they arrive in', async () => {
      await open([PRACTICAL_T, THEORY_T]);

      const labels = screen.getAllByLabelText(/^Anil Rai:/).map((node) => node.props.accessibilityLabel);
      expect(labels).toEqual(['Anil Rai: Theory (out of 80)', 'Anil Rai: Practical (out of 20)']);
    });

    it('disables the Practical box for a subject without a practical component, and never sends it', async () => {
      jest.mocked(getExamResults).mockResolvedValue([]);
      await open([THEORY_T]);
      const user = userEvent.setup();

      const notApplicable = screen.getAllByLabelText('Anil Rai: Practical does not apply to this subject');
      expect(notApplicable).toHaveLength(1);
      expect(notApplicable[0]!.props.accessibilityState).toMatchObject({ disabled: true });
      expect(screen.queryByLabelText('Anil Rai: Practical (out of 20)')).toBeNull();

      // Theory alone completes the student: the disabled box is not a missing mark.
      await enter('Anil Rai', THEORY_T, '70');
      expect(screen.queryByText('Enter every mark for this student')).toBeNull();
      await user.press(saveButton(1));

      await waitFor(() => expect(postBulkMarks).toHaveBeenCalledTimes(1));
      expect(jest.mocked(postBulkMarks).mock.calls[0]![0].items).toEqual([
        { enrollmentId: 'e-anil', components: [{ examComponentId: THEORY.id, obtainedMarks: 70 }], version: 0 },
      ]);
    });
  });
});
