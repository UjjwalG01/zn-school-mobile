import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { getAttendanceSettings, getMyAttendance } from '../../../../api/attendance';
import { getTeacherMyClasses } from '../../../../api/portal';
import { getTenantSettings } from '../../../../api/settings';
import { getMySchools } from '../../../../api/tenancy';
import type { MyAttendance } from '../../../../api/types/attendance';
import type { School } from '../../../../api/types/tenancy';
import { myPermissionsKey, mySchoolsKey } from '../../../../auth/queries';
import { resetSessionForTests, selectTenant } from '../../../../auth/session';
import { mobileModulesKey } from '../../../queries';
import AttendanceTabScreen from '../AttendanceTabScreen';

let mockParams: { subtab?: string } = {};
const mockRedirect = jest.fn();
// `setParams` writes the param the way the router does; the next render reads it back.
const mockSetParams = jest.fn((next: { subtab?: string }) => {
  mockParams = { ...mockParams, ...next };
});
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), setParams: mockSetParams }),
  useLocalSearchParams: () => mockParams,
  Redirect: ({ href }: { href: unknown }) => {
    mockRedirect(href);
    return null;
  },
}));
jest.mock('../../../../api/attendance');
jest.mock('../../../../api/portal');
jest.mock('../../../../api/settings');
jest.mock('../../../../api/tenancy');

const SCHOOL: School = {
  tenantId: 't1',
  name: 'Everest School',
  status: 'active',
  license: { status: 'active', tierName: null, validUntil: null, expiringSoon: false, modules: ['academic'] },
};

const MINE: MyAttendance = {
  staff: { id: 's1', staffCode: 'STF-0001', fullName: 'Sita Sharma', employmentStatus: 'active' },
  today: '2026-10-21',
  todayDay: { schoolDay: true, reason: null, holidayName: null },
  month: '2026-10',
  records: [],
};

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

function seed(permissions: string[]) {
  client.setQueryData(mySchoolsKey(), [SCHOOL]);
  client.setQueryData(myPermissionsKey('t1'), { all: false, keys: permissions });
  client.setQueryData(mobileModulesKey('t1'), []);
}

beforeEach(() => {
  mockParams = {};
  resetSessionForTests();
  selectTenant('t1');
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  jest.mocked(getTeacherMyClasses).mockResolvedValue({
    restricted: true,
    classes: [{ classId: 'c8', className: 'Class 8', sectionId: 's8', sectionName: 'A' }],
    subjects: [],
  });
  jest.mocked(getMyAttendance).mockResolvedValue(MINE);
  jest.mocked(getMySchools).mockResolvedValue([SCHOOL]);
  jest.mocked(getTenantSettings).mockResolvedValue({ calendarPreference: 'gregorian' });
  jest.mocked(getAttendanceSettings).mockResolvedValue({ backdateWindowDays: 7, statuses: [] });
});

afterEach(() => {
  client.clear();
  jest.clearAllMocks();
});

describe('Attendance tab subtabs', () => {
  it('offers Student Attendance and My Attendance, and switches between them', async () => {
    seed(['attendance.mark', 'attendance.self']);
    const { rerender } = await render(<AttendanceTabScreen />, { wrapper });
    const user = userEvent.setup();

    expect(await screen.findByRole('tab', { name: 'Student Attendance', selected: true })).toBeTruthy();
    expect(await screen.findByText('Class 8 · A')).toBeTruthy();
    expect(getMyAttendance).not.toHaveBeenCalled();

    // The control only writes the `subtab` param; the screen follows the param.
    await user.press(screen.getByRole('tab', { name: 'My Attendance' }));
    expect(mockSetParams).toHaveBeenLastCalledWith({ subtab: 'self' });
    await rerender(<AttendanceTabScreen />);
    expect(await screen.findByRole('button', { name: 'Mark present' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'My Attendance', selected: true })).toBeTruthy();

    await user.press(screen.getByRole('tab', { name: 'Student Attendance' }));
    expect(mockSetParams).toHaveBeenLastCalledWith({ subtab: 'students' });
    await rerender(<AttendanceTabScreen />);
    expect(await screen.findByText('Class 8 · A')).toBeTruthy();
  });

  it('keeps the control outside the scrolling area, so a long list scrolls under it', async () => {
    seed(['attendance.mark', 'attendance.self']);
    await render(<AttendanceTabScreen />, { wrapper });

    expect(await screen.findByLabelText('Attendance sections')).toBeTruthy();
    expect(await screen.findByText('Class 8 · A')).toBeTruthy();
    const scrollers = screen.root?.queryAll((node) => node.type === 'RCTScrollView') ?? [];
    expect(scrollers.length).toBeGreaterThan(0);
    for (const scroller of scrollers) {
      expect(within(scroller).queryByLabelText('Attendance sections')).toBeNull();
    }
  });

  it('keeps a one-class teacher on the list instead of jumping to the roster when both subtabs exist', async () => {
    seed(['attendance.mark', 'attendance.self']);
    await render(<AttendanceTabScreen />, { wrapper });

    expect(await screen.findByText('Class 8 · A')).toBeTruthy();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('with only attendance.mark there is no control and a one-class teacher goes straight to the roster', async () => {
    seed(['attendance.mark']);
    await render(<AttendanceTabScreen />, { wrapper });

    await waitFor(() =>
      expect(mockRedirect).toHaveBeenCalledWith({
        pathname: '/teacher/attendance/roster',
        params: { classId: 'c8', sectionId: 's8' },
      }),
    );
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('with only attendance.self it shows My Attendance alone, with no control', async () => {
    seed(['attendance.self']);
    await render(<AttendanceTabScreen />, { wrapper });

    expect(await screen.findByRole('button', { name: 'Mark present' })).toBeTruthy();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(getTeacherMyClasses).not.toHaveBeenCalled();
  });

  it('opens on the subtab the route param names', async () => {
    seed(['attendance.mark', 'attendance.self']);
    mockParams = { subtab: 'self' };
    await render(<AttendanceTabScreen />, { wrapper });

    expect(await screen.findByRole('tab', { name: 'My Attendance', selected: true })).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Mark present' })).toBeTruthy();
  });
});
