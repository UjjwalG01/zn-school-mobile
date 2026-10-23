import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { getAttendanceSettings, getMyAttendance, markMyselfPresent } from '../../../../api/attendance';
import { ApiError, NETWORK_ERROR_CODE } from '../../../../api/errors';
import { getTenantSettings } from '../../../../api/settings';
import type { DayInfo, MarkPresentResult, MyAttendance, StaffAttendanceRecord } from '../../../../api/types/attendance';
import { resetSessionForTests, selectTenant } from '../../../../auth/session';
import { getToast, resetToastForTests } from '../../../../lib/toast';
import MyAttendanceScreen from '../MyAttendanceScreen';

jest.mock('../../../../api/attendance');
jest.mock('../../../../api/settings');

const SCHOOL_DAY: DayInfo = { schoolDay: true, reason: null, holidayName: null };

const record = (attendanceDate: string, status: StaffAttendanceRecord['status'] = 'present'): StaffAttendanceRecord => ({
  id: `r-${attendanceDate}`,
  attendanceDate,
  status,
  remarks: null,
  source: 'self',
  version: 1,
});

const month = (overrides: Partial<MyAttendance> = {}): MyAttendance => ({
  staff: { id: 's1', staffCode: 'STF-0001', fullName: 'Sita Sharma', employmentStatus: 'active' },
  today: '2026-10-21',
  todayDay: SCHOOL_DAY,
  month: '2026-10',
  records: [record('2026-10-19')],
  ...overrides,
});

const created: MarkPresentResult = { outcome: 'created', record: record('2026-10-21'), day: SCHOOL_DAY };

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeEach(() => {
  resetSessionForTests();
  resetToastForTests();
  selectTenant('t1');
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  jest.mocked(getMyAttendance).mockResolvedValue(month());
  jest.mocked(getTenantSettings).mockResolvedValue({ calendarPreference: 'gregorian' });
  jest.mocked(getAttendanceSettings).mockResolvedValue({
    backdateWindowDays: 7,
    statuses: [
      { status: 'present', label: 'In school', shortCode: 'P', sortOrder: 1, active: true },
      { status: 'absent', label: 'Away', shortCode: 'A', sortOrder: 2, active: true },
    ],
  });
});

afterEach(() => {
  client.clear();
  jest.clearAllMocks();
});

describe('My Attendance', () => {
  it('shows today as not marked with a Mark present button, and this month from the backend', async () => {
    await render(<MyAttendanceScreen />, { wrapper });

    expect(await screen.findByText('Not marked')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mark present' })).toBeTruthy();
    expect(screen.getByText('2026-10-21')).toBeTruthy(); // the school's today, as returned
    expect(screen.getByText('October 2026')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('In school')).toBeTruthy()); // the school's own label
    expect(getMyAttendance).toHaveBeenCalledWith(undefined);
  });

  it('summarises the month in one line and lists each day on a compact row', async () => {
    jest
      .mocked(getMyAttendance)
      .mockResolvedValue(month({ records: [record('2026-10-18', 'absent'), record('2026-10-19'), record('2026-10-20')] }));
    await render(<MyAttendanceScreen />, { wrapper });

    expect(await screen.findByText('Away 1 · In school 2')).toBeTruthy();
    expect(screen.getByText('2026-10-18')).toBeTruthy();
    expect(screen.getByText('2026-10-20')).toBeTruthy();
  });

  it('marks present with one body-less call, says so, and shows the stored status instead of the button', async () => {
    jest.mocked(markMyselfPresent).mockResolvedValue(created);
    await render(<MyAttendanceScreen />, { wrapper });

    await userEvent.setup().press(await screen.findByRole('button', { name: 'Mark present' }));

    await waitFor(() => expect(getToast()).toMatchObject({ message: 'Marked present', tone: 'success' }));
    expect(markMyselfPresent).toHaveBeenCalledWith();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Mark present' })).toBeNull());
    expect(screen.queryByText('Not marked')).toBeNull();
    expect(getMyAttendance).toHaveBeenCalledTimes(1); // patched from the response, not refetched
  });

  it('says an unchanged tap changed nothing', async () => {
    jest.mocked(markMyselfPresent).mockResolvedValue({ ...created, outcome: 'unchanged' });
    await render(<MyAttendanceScreen />, { wrapper });

    await userEvent.setup().press(await screen.findByRole('button', { name: 'Mark present' }));

    await waitFor(() => expect(getToast()?.message).toBe('Already marked present'));
  });

  it('sends one request for a double tap while the first is in flight', async () => {
    let resolve: (value: MarkPresentResult) => void = () => undefined;
    jest.mocked(markMyselfPresent).mockReturnValue(new Promise((r) => (resolve = r)));
    await render(<MyAttendanceScreen />, { wrapper });
    const user = userEvent.setup();

    const button = await screen.findByRole('button', { name: 'Mark present' });
    await user.press(button);
    await user.press(button);
    expect(markMyselfPresent).toHaveBeenCalledTimes(1);
    await act(async () => resolve(created));
  });

  it.each([
    [
      new ApiError(409, 'recorded', 'ATTENDANCE_ALREADY_RECORDED'),
      'Your attendance today was recorded another way. Ask an administrator to correct it.',
    ],
    [new ApiError(409, 'inactive'), 'Your staff record is not active. Ask your school.'],
    [new ApiError(400, 'holiday', 'ATTENDANCE_INVALID_DATE'), 'Attendance cannot be marked today.'],
    [new ApiError(0, 'offline', NETWORK_ERROR_CODE), 'No connection. Connect and try again.'],
  ])('shows the refusal as an error toast and keeps the button (%#)', async (error, message) => {
    jest.mocked(markMyselfPresent).mockRejectedValue(error);
    await render(<MyAttendanceScreen />, { wrapper });

    await userEvent.setup().press(await screen.findByRole('button', { name: 'Mark present' }));

    await waitFor(() => expect(getToast()).toMatchObject({ message, tone: 'error' }));
    expect(screen.getByRole('button', { name: 'Mark present' })).toBeTruthy();
  });

  it('asks the school to link the account when it is not linked to a staff member (404)', async () => {
    jest.mocked(getMyAttendance).mockRejectedValue(new ApiError(404, 'not found'));
    await render(<MyAttendanceScreen />, { wrapper });

    expect(
      await screen.findByText('Your account is not linked to a staff record. Ask your school to link it.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mark present' })).toBeNull();
  });

  it('shows the holiday instead of a button on a non-school day', async () => {
    jest
      .mocked(getMyAttendance)
      .mockResolvedValue(
        month({ todayDay: { schoolDay: false, reason: 'holiday', holidayName: 'Dashain' }, records: [] }),
      );
    await render(<MyAttendanceScreen />, { wrapper });

    expect(await screen.findByText('Holiday: Dashain. Attendance cannot be marked.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mark present' })).toBeNull();
    expect(await screen.findByText('No attendance recorded this month.')).toBeTruthy();
  });

  it('loads the previous month on request and cannot go past the current one', async () => {
    const september = month({ month: '2026-09', records: [record('2026-09-30', 'absent')] });
    jest.mocked(getMyAttendance).mockImplementation(async (m) => (m === '2026-09' ? september : month()));
    await render(<MyAttendanceScreen />, { wrapper });
    const user = userEvent.setup();

    await screen.findByText('October 2026');
    expect(screen.getByRole('button', { name: 'Next month', disabled: true })).toBeTruthy();

    await user.press(screen.getByRole('button', { name: 'Previous month' }));
    await waitFor(() => expect(getMyAttendance).toHaveBeenCalledWith('2026-09'));
    expect(await screen.findByText('September 2026')).toBeTruthy();
    expect(await screen.findByText('Away')).toBeTruthy();

    await user.press(screen.getByRole('button', { name: 'Next month' }));
    expect(await screen.findByText('October 2026')).toBeTruthy();
  });
});
