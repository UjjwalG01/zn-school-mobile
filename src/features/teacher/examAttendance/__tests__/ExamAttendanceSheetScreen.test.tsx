import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, userEvent, waitFor, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ApiError, NETWORK_ERROR_CODE } from '../../../../api/errors';
import { getExamAttendanceRoster, putExamAttendance } from '../../../../api/examAttendance';
import { getTenantSettings } from '../../../../api/settings';
import { getMyPermissions, getMySchools } from '../../../../api/tenancy';
import type {
  ExamAttendanceRoster,
  ExamAttendanceRow,
  ExamAttendanceSaveResult,
} from '../../../../api/types/examAttendance';
import { myPermissionsKey } from '../../../../auth/queries';
import { resetSessionForTests, selectTenant } from '../../../../auth/session';
import { getToast, resetToastForTests } from '../../../../lib/toast';
import ExamAttendanceSheetScreen from '../ExamAttendanceSheetScreen';
import { examAttendanceExamsKey } from '../queries';

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
jest.mock('../../../../api/examAttendance');
jest.mock('../../../../api/settings');
jest.mock('../../../../api/tenancy');

const row = (id: string, fullName: string, record: ExamAttendanceRow['record'] = null): ExamAttendanceRow => ({
  enrollmentId: id,
  fullName,
  admissionNumber: `ADM-${id}`,
  rollNumber: null,
  record,
});

const ANIL = row('anil', 'Anil Rai');
const BINA = row('bina', 'Bina Thapa', { status: 'absent', remarks: null, version: 2 });
const CHANDRA = row('chandra', 'Chandra Karki');

const roster = (overrides: Partial<ExamAttendanceRoster> = {}): ExamAttendanceRoster => ({
  exam: { id: 'x5', name: 'Terminal', status: 'published' },
  examSubject: { id: 'p-math', subjectName: 'Mathematics', examDate: '2026-10-20' },
  editable: true,
  rows: [ANIL, BINA, CHANDRA],
  ...overrides,
});

const SAVED: ExamAttendanceSaveResult = {
  ok: true,
  replayed: false,
  results: [
    { enrollmentId: 'anil', id: 'r1', version: 1, outcome: 'created' },
    { enrollmentId: 'chandra', id: 'r3', version: 1, outcome: 'created' },
  ],
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

const picker = (name: string) => within(screen.getByLabelText(`Exam attendance for ${name}`));
const saveButton = (count: number, options: { disabled?: boolean } = {}) =>
  screen.getByRole('button', { name: `Save attendance (${count})`, ...options });

async function openSheet() {
  await render(<ExamAttendanceSheetScreen />, { wrapper });
  await screen.findByText('Anil Rai');
}

beforeEach(() => {
  resetSessionForTests();
  resetToastForTests();
  selectTenant('t1');
  mockParams = { examId: 'x5', examSubjectId: 'p-math' };
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
  jest.mocked(getExamAttendanceRoster).mockResolvedValue(roster());
  jest.mocked(putExamAttendance).mockResolvedValue(SAVED);
  jest.mocked(getTenantSettings).mockResolvedValue({ calendarPreference: 'gregorian' });
  jest.mocked(getMySchools).mockResolvedValue([]);
  jest.mocked(getMyPermissions).mockResolvedValue({ all: false, keys: [] });
});

afterEach(async () => {
  await waitFor(() => expect(client.isFetching() + client.isMutating()).toBe(0));
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
  client.clear();
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

describe('roster', () => {
  it('asks for the paper’s students, titles the screen with the subject, and says which exam and date', async () => {
    await openSheet();

    expect(getExamAttendanceRoster).toHaveBeenCalledWith({ examId: 'x5', examSubjectId: 'p-math', sectionId: null });
    await waitFor(() => expect(mockTitle).toHaveBeenLastCalledWith('Mathematics'));
    expect(screen.getByText('Terminal · 2026-10-20')).toBeTruthy();
    expect(screen.getByText('Present 0 · Absent 1 · Excused 0 · Not marked 2')).toBeTruthy();
  });

  it('narrows to the section it was opened with, and says so', async () => {
    mockParams = { examId: 'x5', examSubjectId: 'p-math', sectionId: 'sb', sectionName: 'B' };
    await openSheet();

    expect(getExamAttendanceRoster).toHaveBeenCalledWith({ examId: 'x5', examSubjectId: 'p-math', sectionId: 'sb' });
    expect(screen.getByText('Terminal · 2026-10-20 · Section B')).toBeTruthy();
  });

  it('shows what is already saved without pre-filling the rest', async () => {
    await openSheet();

    expect(picker('Bina Thapa').getByRole('radio', { name: 'Absent', checked: true })).toBeTruthy();
    expect(picker('Anil Rai').queryByRole('radio', { checked: true })).toBeNull();
  });

  it('says so when no student the teacher teaches sits the paper', async () => {
    jest.mocked(getExamAttendanceRoster).mockResolvedValue(roster({ rows: [] }));
    await render(<ExamAttendanceSheetScreen />, { wrapper });

    expect(await screen.findByText('No students you teach sit this paper.')).toBeTruthy();
  });

  it('shows a paper that cannot be found when the route has no ids', async () => {
    mockParams = {};
    await render(<ExamAttendanceSheetScreen />, { wrapper });

    expect(screen.getByText('This paper could not be found. Go back and choose one.')).toBeTruthy();
    expect(getExamAttendanceRoster).not.toHaveBeenCalled();
  });

  it('is read-only for a draft or locked exam: the rows are shown, nothing can be saved', async () => {
    jest.mocked(getExamAttendanceRoster).mockResolvedValue(roster({ editable: false }));
    await openSheet();

    expect(screen.getByText(/not open for attendance/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Save attendance/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark remaining present' })).toBeNull();
    const radio = picker('Anil Rai').getByRole('radio', { name: 'Present' });
    expect(radio.props.accessibilityState?.disabled).toBe(true);
  });

  it('says there is no access on a 403', async () => {
    jest.mocked(getExamAttendanceRoster).mockRejectedValue(new ApiError(403, 'Not linked to a staff member'));
    await render(<ExamAttendanceSheetScreen />, { wrapper });

    await waitFor(() => expect(screen.getByText("You don't have access to this section.")).toBeTruthy());
  });
});

describe('saving', () => {
  it('sends only what changed, with the version seen, one idempotency key, and no section for the whole roster', async () => {
    await openSheet();
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Mark remaining present' }));
    await user.press(picker('Chandra Karki').getByRole('radio', { name: 'Excused' }));
    await user.press(saveButton(2));

    await waitFor(() => expect(putExamAttendance).toHaveBeenCalledTimes(1));
    const [examId, body] = jest.mocked(putExamAttendance).mock.calls[0]!;
    expect(examId).toBe('x5');
    expect(body.examSubjectId).toBe('p-math');
    expect(body.idempotencyKey).toMatch(UUID);
    expect(body.records).toEqual([
      { enrollmentId: 'anil', status: 'present', version: 0 },
      { enrollmentId: 'chandra', status: 'excused', version: 0 },
    ]); // Bina was not touched
    await waitFor(() => expect(getToast()).toMatchObject({ message: 'Exam attendance saved', tone: 'success' }));
    // The write response is used: no second roster request.
    expect(getExamAttendanceRoster).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Present 1 · Absent 1 · Excused 1 · Not marked 0')).toBeTruthy();
  });

  it('sends an edited row with the version the teacher saw', async () => {
    await openSheet();
    const user = userEvent.setup();

    await user.press(picker('Bina Thapa').getByRole('radio', { name: 'Present' }));
    await user.press(saveButton(1));

    await waitFor(() => expect(putExamAttendance).toHaveBeenCalled());
    expect(jest.mocked(putExamAttendance).mock.calls[0]![1].records).toEqual([
      { enrollmentId: 'bina', status: 'present', version: 2 },
    ]);
  });

  it('does not save with nothing changed', async () => {
    await openSheet();

    expect(saveButton(0, { disabled: true })).toBeTruthy();
    expect(screen.getByText('No changes to save')).toBeTruthy();
    expect(putExamAttendance).not.toHaveBeenCalled();
  });

  it('lists a refused batch by student, writes nothing, and keeps the edits', async () => {
    jest.mocked(putExamAttendance).mockResolvedValue({
      ok: false,
      failures: [{ identifier: { enrollmentId: 'anil', row: 1 }, error: "enrollmentId is not in this exam's population" }],
    });
    await openSheet();
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Mark remaining present' }));
    await user.press(saveButton(2));

    await waitFor(() => expect(screen.getByText("enrollmentId is not in this exam's population")).toBeTruthy());
    expect(screen.getByText('Nothing was saved. Check the students below and save again.')).toBeTruthy();
    expect(saveButton(2)).toBeTruthy();
    expect(getToast()).toBeNull();
  });

  it('keeps the edits and the same key when the connection fails, so a retry is a replay and not a second write', async () => {
    jest
      .mocked(putExamAttendance)
      .mockRejectedValueOnce(new ApiError(0, 'offline', NETWORK_ERROR_CODE))
      .mockResolvedValueOnce(SAVED);
    await openSheet();
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Mark remaining present' }));
    await user.press(saveButton(2));
    await waitFor(() =>
      expect(screen.getByText('No connection. Your changes are kept. Save again when you are online.')).toBeTruthy(),
    );

    await user.press(saveButton(2));
    await waitFor(() => expect(getToast()?.message).toBe('Exam attendance saved'));
    const keys = jest.mocked(putExamAttendance).mock.calls.map(([, body]) => body.idempotencyKey);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('gets a new key once the payload changes', async () => {
    jest.mocked(putExamAttendance).mockRejectedValue(new ApiError(0, 'offline', NETWORK_ERROR_CODE));
    await openSheet();
    const user = userEvent.setup();

    await user.press(picker('Anil Rai').getByRole('radio', { name: 'Present' }));
    await user.press(saveButton(1));
    await waitFor(() => expect(putExamAttendance).toHaveBeenCalledTimes(1));
    await user.press(picker('Anil Rai').getByRole('radio', { name: 'Absent' }));
    await user.press(saveButton(1));
    await waitFor(() => expect(putExamAttendance).toHaveBeenCalledTimes(2));

    const keys = jest.mocked(putExamAttendance).mock.calls.map(([, body]) => body.idempotencyKey);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('shows the backend’s own words when the exam is not open or the paper is not held yet', async () => {
    jest
      .mocked(putExamAttendance)
      .mockRejectedValue(new ApiError(400, 'This paper is on 2026-10-30; attendance cannot be recorded before it is held', 'ATTENDANCE_INVALID_DATE'));
    await openSheet();
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Mark remaining present' }));
    await user.press(saveButton(2));

    await waitFor(() =>
      expect(screen.getByText('This paper is on 2026-10-30; attendance cannot be recorded before it is held')).toBeTruthy(),
    );
  });

  it('says the teacher cannot record these students on a 403, keeps the edits and refreshes the lists', async () => {
    jest.mocked(putExamAttendance).mockRejectedValue(new ApiError(403, 'You can record exam attendance only for students in the classes and sections you teach'));
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    await openSheet();
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Mark remaining present' }));
    await user.press(saveButton(2));

    await waitFor(() => expect(screen.getByText("You can't record exam attendance for these students.")).toBeTruthy());
    expect(saveButton(2)).toBeTruthy();
    // The cached permissions and the exam list may be out of date: both are marked stale.
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(myPermissionsKey('t1'));
    expect(keys).toContainEqual(examAttendanceExamsKey('t1'));
  });

  it('guards the back gesture while there are unsaved edits', async () => {
    await openSheet();
    const user = userEvent.setup();
    expect(mockAddListener).not.toHaveBeenCalled();

    await user.press(picker('Anil Rai').getByRole('radio', { name: 'Present' }));
    await waitFor(() => expect(mockAddListener).toHaveBeenCalledWith('beforeRemove', expect.any(Function)));
  });
});

describe('conflicts', () => {
  it('flags a student someone else changed, and lets the teacher keep theirs or use the saved one', async () => {
    jest
      .mocked(putExamAttendance)
      .mockResolvedValueOnce({
        ok: false,
        failures: [{ identifier: { enrollmentId: 'bina', row: 1 }, error: 'The record was changed by someone else' }],
      });
    await openSheet();
    const user = userEvent.setup();

    await user.press(picker('Bina Thapa').getByRole('radio', { name: 'Present' }));
    // Someone else marked Bina excused meanwhile (version 3); the refused save refreshes the roster.
    jest.mocked(getExamAttendanceRoster).mockResolvedValue(
      roster({ rows: [ANIL, row('bina', 'Bina Thapa', { status: 'excused', remarks: null, version: 3 }), CHANDRA] }),
    );
    await user.press(saveButton(1));

    expect(await screen.findByText('Changed by someone else. Now: Excused. Yours: Present')).toBeTruthy();
    expect(saveButton(1, { disabled: true })).toBeTruthy();
    expect(screen.getByText('Resolve the highlighted students first')).toBeTruthy();

    await user.press(screen.getByRole('button', { name: 'Keep mine' }));
    await waitFor(() => expect(screen.queryByText(/Changed by someone else/)).toBeNull());
    await user.press(saveButton(1));
    await waitFor(() => expect(putExamAttendance).toHaveBeenCalledTimes(2));
    expect(jest.mocked(putExamAttendance).mock.calls[1]![1].records).toEqual([
      { enrollmentId: 'bina', status: 'present', version: 3 },
    ]);
  });
});
