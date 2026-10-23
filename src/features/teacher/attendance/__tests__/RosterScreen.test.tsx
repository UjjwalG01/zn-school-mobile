import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, userEvent, waitFor, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Alert } from 'react-native';

import { getAttendanceRoster, getAttendanceSettings, postBulkAttendance } from '../../../../api/attendance';
import { ApiError, NETWORK_ERROR_CODE } from '../../../../api/errors';
import { getTeacherMyClasses } from '../../../../api/portal';
import { getMobileModules, getTenantSettings } from '../../../../api/settings';
import { getMySchools, getMyPermissions } from '../../../../api/tenancy';
import type {
  AttendanceRoster,
  AttendanceSettings,
  AttendanceStatus,
  BulkAttendanceResult,
  RosterRow,
} from '../../../../api/types/attendance';
import { resetSessionForTests, selectTenant } from '../../../../auth/session';
import { shiftIsoDate, todayIso } from '../../../../lib/date';
import { getToast, resetToastForTests } from '../../../../lib/toast';
import RosterScreen from '../RosterScreen';

let mockParams: Record<string, string | undefined> = {};
const mockTitle = jest.fn();
const mockAddListener = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  Stack: {
    Screen: ({ options }: { options: { title?: string } }) => {
      mockTitle(options.title);
      return null;
    },
  },
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({ addListener: mockAddListener, dispatch: jest.fn() }),
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('../../../../api/attendance');
jest.mock('../../../../api/portal');
jest.mock('../../../../api/settings');
jest.mock('../../../../api/tenancy');

const row = (
  id: string,
  fullName: string,
  record: { status: AttendanceStatus; version: number } | null = null,
): RosterRow => ({
  enrollmentId: `e-${id}`,
  studentId: id,
  fullName,
  admissionNumber: `ADM-${id}`,
  rollNumber: null,
  sectionId: 's8',
  record: record && { id: `r-${id}`, status: record.status, remarks: null, version: record.version },
});

const ANIL = row('anil', 'Anil Rai');
const BINA = row('bina', 'Bina Thapa', { status: 'absent', version: 2 });
const CHANDRA = row('chandra', 'Chandra Karki');

const ROSTER: AttendanceRoster = {
  date: todayIso(),
  dayInfo: { schoolDay: true, reason: null, holidayName: null },
  rows: [ANIL, BINA, CHANDRA],
};

// The school renamed "present" to "Here" and switched half-day off.
const SETTINGS: AttendanceSettings = {
  backdateWindowDays: 7,
  statuses: [
    { status: 'present', label: 'Here', shortCode: 'P', sortOrder: 1, active: true },
    { status: 'absent', label: 'Absent', shortCode: 'A', sortOrder: 2, active: true },
    { status: 'late', label: 'Late', shortCode: 'L', sortOrder: 3, active: true },
    { status: 'half_day', label: 'Half day', shortCode: 'HD', sortOrder: 4, active: false },
    { status: 'excused', label: 'Excused', shortCode: 'E', sortOrder: 5, active: true },
  ],
};

const SAVED: BulkAttendanceResult = { ok: true, replayed: false, results: [] };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

const picker = (name: string) => within(screen.getByLabelText(`Status for ${name}`));
const saveButton = (count: number, options: { disabled?: boolean } = {}) =>
  screen.getByRole('button', { name: `Save attendance (${count})`, ...options });

async function openRoster() {
  await render(<RosterScreen />, { wrapper });
  await screen.findByText('Anil Rai');
}

beforeEach(() => {
  resetSessionForTests();
  resetToastForTests();
  selectTenant('t1');
  mockParams = { classId: 'c8', sectionId: 's8' };
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
  jest.mocked(getAttendanceRoster).mockResolvedValue(ROSTER);
  jest.mocked(getAttendanceSettings).mockResolvedValue(SETTINGS);
  jest.mocked(postBulkAttendance).mockResolvedValue(SAVED);
  jest.mocked(getTeacherMyClasses).mockResolvedValue({
    restricted: true,
    classes: [{ classId: 'c8', className: 'Class 8', sectionId: 's8', sectionName: 'A' }],
    subjects: [],
  });
  jest.mocked(getTenantSettings).mockResolvedValue({ calendarPreference: 'gregorian' });
  jest.mocked(getMySchools).mockResolvedValue([]);
  jest.mocked(getMyPermissions).mockResolvedValue({ all: false, keys: [] });
  jest.mocked(getMobileModules).mockResolvedValue([]);
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(async () => {
  // Queries the test did not wait for (my-classes, settings) must settle, and their 0 ms notify timer
  // must fire, inside act; otherwise React warns about an update after the test ended.
  await waitFor(() => expect(client.isFetching() + client.isMutating()).toBe(0));
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
  client.clear();
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

describe('roster', () => {
  it("asks for the class's roster and titles the screen with the class", async () => {
    await openRoster();

    expect(getAttendanceRoster).toHaveBeenCalledWith({ date: todayIso(), classId: 'c8', sectionId: 's8' });
    await waitFor(() => expect(mockTitle).toHaveBeenLastCalledWith('Class 8 · A'));
  });

  it("leaves the section out for a class with none", async () => {
    mockParams = { classId: 'c6' };
    await openRoster();

    expect(getAttendanceRoster).toHaveBeenCalledWith({ date: todayIso(), classId: 'c6', sectionId: null });
  });

  it("shows the school's own wording, hides a switched-off status, and counts with those labels", async () => {
    await openRoster();

    expect(picker('Anil Rai').getByRole('radio', { name: 'Here' })).toBeTruthy();
    expect(picker('Anil Rai').getByRole('radio', { name: 'Excused' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Half day' })).toBeNull();
    expect(screen.getByText('Here 0 · Absent 1 · Late 0 · Excused 0 · Not marked 2')).toBeTruthy();
    // Bina is already saved as absent: shown as such, with that radio selected.
    expect(picker('Bina Thapa').getByRole('radio', { name: 'Absent', checked: true })).toBeTruthy();
  });

  it("still shows the label of a status the school has since switched off, but cannot be newly picked", async () => {
    jest.mocked(getAttendanceRoster).mockResolvedValue({
      ...ROSTER,
      rows: [row('dev', 'Dev Gurung', { status: 'half_day', version: 1 })],
    });
    await render(<RosterScreen />, { wrapper });

    await screen.findByText('Dev Gurung');
    expect(screen.getAllByText('Half day').length).toBeGreaterThan(0);
    expect(screen.queryByRole('radio', { name: 'Half day' })).toBeNull();
  });

  it('shows a message for a class with no students on that date', async () => {
    jest.mocked(getAttendanceRoster).mockResolvedValue({ ...ROSTER, rows: [] });
    await render(<RosterScreen />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText('No students are enrolled in this class on this date.')).toBeTruthy(),
    );
  });

  it('says there is no access when the roster is forbidden', async () => {
    jest.mocked(getAttendanceRoster).mockRejectedValue(new ApiError(403, 'Forbidden'));
    await render(<RosterScreen />, { wrapper });

    await waitFor(() => expect(screen.getByText("You don't have access to this section.")).toBeTruthy());
  });

  it('asks the teacher to pick a class when the route has none', async () => {
    mockParams = {};
    await render(<RosterScreen />, { wrapper });
    // The screen still loads the school's settings and my-classes (for the title); let them land in act.
    await waitFor(() => expect(client.isFetching()).toBe(0));

    expect(screen.getByText('This class could not be found. Go back and choose a class.')).toBeTruthy();
    expect(getAttendanceRoster).not.toHaveBeenCalled();
  });
});

describe('marking and saving', () => {
  it('marks the remaining students present and saves them in one request, with their versions', async () => {
    await openRoster();
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Mark remaining present' }));

    expect(screen.getByText('Here 2 · Absent 1 · Late 0 · Excused 0 · Not marked 0')).toBeTruthy();
    await user.press(saveButton(2));

    await waitFor(() => expect(postBulkAttendance).toHaveBeenCalledTimes(1));
    const body = jest.mocked(postBulkAttendance).mock.calls[0]![0];
    expect(body.idempotencyKey).toMatch(UUID);
    expect(body).toMatchObject({ attendanceDate: todayIso(), classId: 'c8', sectionId: 's8' });
    expect(body.records).toEqual([
      { studentId: 'anil', status: 'present', version: 0 },
      { studentId: 'chandra', status: 'present', version: 0 }, // Bina was not touched, so she is not sent
    ]);
  });

  it('confirms with a toast, clears the changes and does not re-request the roster', async () => {
    jest.mocked(postBulkAttendance).mockResolvedValue({
      ok: true,
      replayed: false,
      results: [
        { studentId: 'anil', id: 'ra', version: 1, outcome: 'created' },
        { studentId: 'chandra', id: 'rc', version: 1, outcome: 'created' },
      ],
    });
    await openRoster();
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Mark remaining present' }));
    await user.press(saveButton(2));

    await waitFor(() => expect(getToast()).toMatchObject({ message: 'Attendance saved', tone: 'success' }));
    expect(screen.getByRole('button', { name: 'Save attendance (0)', disabled: true })).toBeTruthy();
    expect(screen.getByText('No changes to save')).toBeTruthy();
    expect(screen.getByText('Here 2 · Absent 1 · Late 0 · Excused 0 · Not marked 0')).toBeTruthy();
    expect(getAttendanceRoster).toHaveBeenCalledTimes(1); // the response patched the cache
  });

  it('lets the teacher change one student and sends only that change', async () => {
    await openRoster();
    const user = userEvent.setup();

    await user.press(picker('Bina Thapa').getByRole('radio', { name: 'Late' }));
    await user.press(saveButton(1));

    await waitFor(() => expect(postBulkAttendance).toHaveBeenCalledTimes(1));
    expect(jest.mocked(postBulkAttendance).mock.calls[0]![0].records).toEqual([
      { studentId: 'bina', status: 'late', version: 2 },
    ]);
  });

  it('sends a remark with the status', async () => {
    await openRoster();
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Add remark' })); // only Bina has a status
    await user.type(screen.getByLabelText('Remark'), 'fever');
    await user.press(saveButton(1));

    await waitFor(() => expect(postBulkAttendance).toHaveBeenCalledTimes(1));
    expect(jest.mocked(postBulkAttendance).mock.calls[0]![0].records).toEqual([
      { studentId: 'bina', status: 'absent', remarks: 'fever', version: 2 },
    ]);
  });

  it('offers nothing to save until something changes', async () => {
    await openRoster();

    expect(saveButton(0, { disabled: true })).toBeTruthy();
    expect(screen.getByText('No changes to save')).toBeTruthy();
    expect(postBulkAttendance).not.toHaveBeenCalled();
  });

  it('sends one request even if Save is pressed twice quickly', async () => {
    let finish!: (result: BulkAttendanceResult) => void;
    jest.mocked(postBulkAttendance).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    await openRoster();
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Mark remaining present' }));
    await user.press(saveButton(2));
    await user.press(screen.getByRole('button', { name: 'Save attendance (2)', busy: true }));

    expect(postBulkAttendance).toHaveBeenCalledTimes(1);
    finish(SAVED);
    await waitFor(() => expect(getToast()?.message).toBe('Attendance saved'));
  });

  it('cannot save more students than one request carries, and says so', async () => {
    const many = Array.from({ length: 201 }, (_, i) => row(`s${i}`, `Student ${i}`));
    jest.mocked(getAttendanceRoster).mockResolvedValue({ ...ROSTER, rows: many });
    await render(<RosterScreen />, { wrapper });
    const user = userEvent.setup();

    await user.press(await screen.findByRole('button', { name: 'Mark remaining present' }));

    expect(screen.getByText('More than 200 students cannot be saved at once. Use the web app.')).toBeTruthy();
    expect(saveButton(201, { disabled: true })).toBeTruthy();
  });
});

describe('a save that does not go through', () => {
  const refused: BulkAttendanceResult = {
    ok: false,
    failures: [
      { identifier: { studentId: 'anil', row: 1 }, error: 'This student is not currently placed in this class/section' },
    ],
  };

  it("shows the backend's reason under the student, keeps the changes and refreshes the roster and settings", async () => {
    jest.mocked(postBulkAttendance).mockResolvedValue(refused);
    await openRoster();
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Mark remaining present' }));
    await user.press(saveButton(2));

    await waitFor(() =>
      expect(screen.getByText('This student is not currently placed in this class/section')).toBeTruthy(),
    );
    expect(screen.getByText('Nothing was saved. Check the students below and save again.')).toBeTruthy();
    expect(saveButton(2)).toBeTruthy(); // the changes are still there
    await waitFor(() => expect(getAttendanceRoster).toHaveBeenCalledTimes(2));
    expect(getAttendanceSettings).toHaveBeenCalledTimes(2);
    expect(getToast()).toBeNull();
  });

  it('keeps the changes and says so when the connection fails, and retries with the same key', async () => {
    jest
      .mocked(postBulkAttendance)
      .mockRejectedValueOnce(new ApiError(0, 'offline', NETWORK_ERROR_CODE))
      .mockResolvedValueOnce(SAVED);
    await openRoster();
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Mark remaining present' }));
    await user.press(saveButton(2));
    await waitFor(() =>
      expect(screen.getByText('No connection. Your changes are kept. Save again when you are online.')).toBeTruthy(),
    );
    expect(saveButton(2)).toBeTruthy();

    await user.press(saveButton(2));
    await waitFor(() => expect(getToast()?.message).toBe('Attendance saved'));

    const keys = jest.mocked(postBulkAttendance).mock.calls.map(([body]) => body.idempotencyKey);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect(screen.queryByText(/No connection/)).toBeNull();
  });

  it("shows the backend's own message for a request-level refusal such as a holiday", async () => {
    jest
      .mocked(postBulkAttendance)
      .mockRejectedValue(new ApiError(400, 'Attendance cannot be marked on a holiday', 'ATTENDANCE_INVALID_DATE'));
    await openRoster();
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Mark remaining present' }));
    await user.press(saveButton(2));

    await waitFor(() => expect(screen.getByText('Attendance cannot be marked on a holiday')).toBeTruthy());
    expect(saveButton(2)).toBeTruthy();
  });

  it('says the teacher cannot mark this class on a 403, and keeps the changes', async () => {
    jest.mocked(postBulkAttendance).mockRejectedValue(new ApiError(403, 'Not the class teacher'));
    await openRoster();
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Mark remaining present' }));
    await user.press(saveButton(2));

    await waitFor(() => expect(screen.getByText("You can't mark attendance for this class.")).toBeTruthy());
    expect(saveButton(2)).toBeTruthy();
  });

  it('asks the teacher to check the highlighted students after a 409', async () => {
    jest.mocked(postBulkAttendance).mockRejectedValue(new ApiError(409, 'recorded by someone else'));
    await openRoster();
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Mark remaining present' }));
    await user.press(saveButton(2));

    await waitFor(() => expect(screen.getByText(/was changed at the same time/)).toBeTruthy());
    await waitFor(() => expect(getAttendanceRoster).toHaveBeenCalledTimes(2));
  });
});

describe('a student changed by someone else', () => {
  const REFRESHED: AttendanceRoster = {
    ...ROSTER,
    rows: [ANIL, row('bina', 'Bina Thapa', { status: 'late', version: 3 }), CHANDRA],
  };

  async function editBinaThenRefresh() {
    await openRoster();
    const user = userEvent.setup();
    await user.press(picker('Bina Thapa').getByRole('radio', { name: 'Here' })); // absent → present, seen at version 2
    jest.mocked(getAttendanceRoster).mockResolvedValue(REFRESHED); // meanwhile someone saved her as late (v3)
    const scrollView = screen.root!.queryAll((node) => node.type === 'RCTScrollView')[0]!;
    await user.pullToRefresh(scrollView);
    await screen.findByText('Changed by someone else. Now: Late. Yours: Here');
    return user;
  }

  it('flags the student, shows both values and blocks Save until it is resolved', async () => {
    await editBinaThenRefresh();

    expect(screen.getByText('Resolve the highlighted students first')).toBeTruthy();
    expect(saveButton(1, { disabled: true })).toBeTruthy();
  });

  it('"Keep mine" re-applies the edit on top of the newer version and unblocks Save', async () => {
    const user = await editBinaThenRefresh();

    await user.press(screen.getByRole('button', { name: 'Keep mine' }));
    expect(screen.queryByText(/Changed by someone else/)).toBeNull();

    await user.press(saveButton(1));
    await waitFor(() => expect(postBulkAttendance).toHaveBeenCalledTimes(1));
    expect(jest.mocked(postBulkAttendance).mock.calls[0]![0].records).toEqual([
      { studentId: 'bina', status: 'present', version: 3 }, // the newer version, chosen explicitly
    ]);
  });

  it('"Use theirs" drops the edit and shows what is saved', async () => {
    const user = await editBinaThenRefresh();

    await user.press(screen.getByRole('button', { name: 'Use theirs' }));

    expect(screen.queryByText(/Changed by someone else/)).toBeNull();
    expect(picker('Bina Thapa').getByRole('radio', { name: 'Late', checked: true })).toBeTruthy();
    expect(saveButton(0, { disabled: true })).toBeTruthy();
  });
});

describe('a day that is not a school day', () => {
  beforeEach(() => {
    jest.mocked(getAttendanceRoster).mockResolvedValue({
      ...ROSTER,
      dayInfo: { schoolDay: false, reason: 'holiday', holidayName: 'Dashain' },
    });
  });

  it('shows why, keeps the roster readable and offers no way to change or save', async () => {
    await openRoster();

    expect(screen.getByText('Holiday: Dashain. Attendance cannot be marked.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Save attendance/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark remaining present' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add remark' })).toBeNull();
    expect(picker('Anil Rai').getByRole('radio', { name: 'Here', disabled: true })).toBeTruthy();
    expect(picker('Bina Thapa').getByRole('radio', { name: 'Absent', checked: true })).toBeTruthy();
  });

  it('words a weekly off and an unnamed non-school day', async () => {
    jest.mocked(getAttendanceRoster).mockResolvedValue({
      ...ROSTER,
      dayInfo: { schoolDay: false, reason: 'weekly_off', holidayName: null },
    });
    const { unmount } = await render(<RosterScreen />, { wrapper });
    await screen.findByText('Weekly off. Attendance cannot be marked.');
    await unmount();
    client.clear();

    jest.mocked(getAttendanceRoster).mockResolvedValue({
      ...ROSTER,
      dayInfo: { schoolDay: false, reason: null, holidayName: null },
    });
    await render(<RosterScreen />, { wrapper });
    await screen.findByText('Not a school day. Attendance cannot be marked.');
  });
});

describe('the date', () => {
  it('opens on today, cannot go past today, and can step back within the backdate window', async () => {
    await openRoster();
    const user = userEvent.setup();

    expect(screen.getByRole('button', { name: 'Next day', disabled: true })).toBeTruthy();

    await user.press(screen.getByRole('button', { name: 'Previous day' }));
    await waitFor(() =>
      expect(getAttendanceRoster).toHaveBeenLastCalledWith({
        date: shiftIsoDate(todayIso(), -1),
        classId: 'c8',
        sectionId: 's8',
      }),
    );
  });

  it('stops at the edge of the backdate window', async () => {
    jest.mocked(getAttendanceSettings).mockResolvedValue({ ...SETTINGS, backdateWindowDays: 0 });
    await openRoster();

    expect(screen.getByRole('button', { name: 'Previous day', disabled: true })).toBeTruthy();
  });

  it('asks before leaving a day with unsaved changes, and starts clean on the new day if confirmed', async () => {
    await openRoster();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Mark remaining present' }));

    await user.press(screen.getByRole('button', { name: 'Previous day' }));

    expect(Alert.alert).toHaveBeenCalledWith('Discard changes?', 'Your unsaved attendance will be lost.', expect.any(Array));
    expect(getAttendanceRoster).toHaveBeenCalledTimes(1); // nothing changed day yet

    const buttons = jest.mocked(Alert.alert).mock.calls[0]![2]!;
    await act(async () => {
      buttons.find((button) => button.text === 'Discard')!.onPress!();
    });

    await waitFor(() => expect(getAttendanceRoster).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', { name: 'Save attendance (0)', disabled: true })).toBeTruthy();
  });

  it('keeps the changes and the day if the teacher chooses to keep editing', async () => {
    await openRoster();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Mark remaining present' }));

    await user.press(screen.getByRole('button', { name: 'Previous day' }));
    const keep = jest.mocked(Alert.alert).mock.calls[0]![2]!.find((b) => b.text === 'Keep editing')!;

    expect(keep.style).toBe('cancel');
    expect(saveButton(2)).toBeTruthy();
    expect(getAttendanceRoster).toHaveBeenCalledTimes(1);
  });
});

describe('leaving with unsaved changes', () => {
  const guard = () => {
    const call = mockAddListener.mock.calls.at(-1);
    return call ? { event: call[0] as string, handler: call[1] as (event: unknown) => void } : null;
  };
  const backEvent = (type: string) => ({ data: { action: { type } }, preventDefault: jest.fn() });

  it('does not guard the screen while nothing has changed', async () => {
    await openRoster();

    expect(mockAddListener).not.toHaveBeenCalled();
  });

  it("asks before the teacher's own back gesture discards unsaved attendance", async () => {
    await openRoster();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Mark remaining present' }));

    expect(guard()?.event).toBe('beforeRemove');
    const event = backEvent('POP');
    guard()!.handler(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Discard changes?', 'Your unsaved attendance will be lost.', expect.any(Array));
  });

  it('never blocks a sign-out or school switch, which replace or reset the stack', async () => {
    await openRoster();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Mark remaining present' }));

    for (const type of ['REPLACE', 'RESET', 'NAVIGATE']) {
      const event = backEvent(type);
      guard()!.handler(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
    }
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});

describe('student details action', () => {
  const SCHOOL = {
    tenantId: 't1',
    name: 'School',
    status: 'active',
    license: { status: 'active', tierName: null, validUntil: null, expiringSoon: false, modules: ['academic'] },
  };
  const detailsOf = (name: string) => `Student details for ${name}`;

  it('is not offered to a teacher who lacks attendance.mark', async () => {
    jest.mocked(getMySchools).mockResolvedValue([SCHOOL]);
    jest.mocked(getMyPermissions).mockResolvedValue({ all: false, keys: ['attendance.read'] });
    await openRoster();

    expect(screen.queryByRole('button', { name: detailsOf('Anil Rai') })).toBeNull();
  });

  it('is offered on every row to a class teacher and opens that student', async () => {
    jest.mocked(getMySchools).mockResolvedValue([SCHOOL]);
    jest.mocked(getMyPermissions).mockResolvedValue({ all: false, keys: ['attendance.mark', 'attendance.read'] });
    await openRoster();
    const user = userEvent.setup();

    await user.press(await screen.findByRole('button', { name: detailsOf('Anil Rai') }));

    expect(mockPush).toHaveBeenCalledWith('/teacher/attendance/student?studentId=anil');
    expect(screen.getByRole('button', { name: detailsOf('Bina Thapa') })).toBeTruthy();
    expect(screen.getByRole('button', { name: detailsOf('Chandra Karki') })).toBeTruthy();
  });

  it('is hidden when the school switched the students module off for mobile', async () => {
    jest.mocked(getMySchools).mockResolvedValue([SCHOOL]);
    jest.mocked(getMyPermissions).mockResolvedValue({ all: false, keys: ['attendance.mark', 'attendance.read'] });
    jest.mocked(getMobileModules).mockResolvedValue([{ moduleKey: 'students', visible: false }]);
    await openRoster();
    await waitFor(() => expect(getMobileModules).toHaveBeenCalled());

    expect(screen.queryByRole('button', { name: detailsOf('Anil Rai') })).toBeNull();
  });

  it('opening a student marks nothing and leaves the draft alone', async () => {
    jest.mocked(getMySchools).mockResolvedValue([SCHOOL]);
    jest.mocked(getMyPermissions).mockResolvedValue({ all: false, keys: ['attendance.mark', 'attendance.read'] });
    await openRoster();
    const user = userEvent.setup();

    await user.press(await screen.findByRole('button', { name: detailsOf('Anil Rai') }));

    expect(saveButton(0, { disabled: true })).toBeTruthy();
    expect(postBulkAttendance).not.toHaveBeenCalled();
  });
});
