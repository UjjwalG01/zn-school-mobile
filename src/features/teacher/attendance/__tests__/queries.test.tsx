import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { getAttendanceRoster, getAttendanceSettings } from '../../../../api/attendance';
import { removeTenantQueries, USER_SCOPE } from '../../../../api/queryKeys';
import type { AttendanceRoster, AttendanceSettings } from '../../../../api/types/attendance';
import { resetSessionForTests, selectTenant } from '../../../../auth/session';
import {
  attendanceRosterKey,
  attendanceSettingsKey,
  useAttendanceRoster,
  useAttendanceSettings,
} from '../queries';

jest.mock('../../../../api/attendance');

const roster = (name: string): AttendanceRoster => ({
  date: '2026-10-21',
  dayInfo: { schoolDay: true, reason: null, holidayName: null },
  rows: [
    {
      enrollmentId: 'e1',
      studentId: 's1',
      fullName: name,
      admissionNumber: 'A1',
      rollNumber: null,
      sectionId: null,
      record: null,
    },
  ],
});
const SETTINGS: AttendanceSettings = { backdateWindowDays: 7, statuses: [] };
const QUERY = { date: '2026-10-21', classId: 'c1', sectionId: 's1' };

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeEach(() => {
  resetSessionForTests();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  jest.mocked(getAttendanceRoster).mockResolvedValue(roster('Anil'));
  jest.mocked(getAttendanceSettings).mockResolvedValue(SETTINGS);
});

afterEach(() => {
  client.clear();
  jest.clearAllMocks();
});

describe('attendance query keys', () => {
  it('start with the school, then the date, class and section, so a school switch cannot show another school', () => {
    expect(attendanceRosterKey('t1', QUERY)).toEqual(['t1', 'attendance', 'roster', '2026-10-21', 'c1', 's1']);
    expect(attendanceRosterKey('t1', { ...QUERY, sectionId: null })).toEqual([
      't1',
      'attendance',
      'roster',
      '2026-10-21',
      'c1',
      'none',
    ]);
    expect(attendanceSettingsKey('t1')).toEqual(['t1', 'attendance', 'settings']);
  });

  it('use the user scope, never a school, before a school is selected', () => {
    expect(attendanceRosterKey(null, QUERY)[0]).toBe(USER_SCOPE);
    expect(attendanceSettingsKey(null)[0]).toBe(USER_SCOPE);
  });

  it('are different for different dates and classes', () => {
    expect(attendanceRosterKey('t1', QUERY)).not.toEqual(attendanceRosterKey('t1', { ...QUERY, date: '2026-10-20' }));
    expect(attendanceRosterKey('t1', QUERY)).not.toEqual(attendanceRosterKey('t1', { ...QUERY, classId: 'c2' }));
  });

  it('are removed with the rest of a school on a school switch, and only that school', () => {
    client.setQueryData(attendanceRosterKey('t1', QUERY), roster('Anil'));
    client.setQueryData(attendanceSettingsKey('t1'), SETTINGS);
    client.setQueryData(attendanceRosterKey('t2', QUERY), roster('Other school'));

    removeTenantQueries(client, 't1');

    expect(client.getQueryData(attendanceRosterKey('t1', QUERY))).toBeUndefined();
    expect(client.getQueryData(attendanceSettingsKey('t1'))).toBeUndefined();
    expect(client.getQueryData(attendanceRosterKey('t2', QUERY))).toBeDefined();
  });
});

describe('useAttendanceRoster', () => {
  it('requests the roster for the selected school and keeps schools apart', async () => {
    selectTenant('t1');
    const first = await renderHook(() => useAttendanceRoster(QUERY), { wrapper });
    await waitFor(() => expect(first.result.current.data?.rows[0]?.fullName).toBe('Anil'));
    expect(getAttendanceRoster).toHaveBeenCalledWith(QUERY);

    // Same class and date in another school: the hook follows the new school and never shows school 1's roster.
    jest.mocked(getAttendanceRoster).mockResolvedValue(roster('Sunita'));
    await act(async () => {
      selectTenant('t2');
    });
    await waitFor(() => expect(first.result.current.data?.rows[0]?.fullName).toBe('Sunita'));
    expect(getAttendanceRoster).toHaveBeenCalledTimes(2); // not served from school 1's cache entry

    expect(client.getQueryData<AttendanceRoster>(attendanceRosterKey('t1', QUERY))?.rows[0]?.fullName).toBe('Anil');
    expect(client.getQueryData<AttendanceRoster>(attendanceRosterKey('t2', QUERY))?.rows[0]?.fullName).toBe('Sunita');
  });

  it('stays off with no class, and with no school', async () => {
    selectTenant('t1');
    await renderHook(() => useAttendanceRoster(null), { wrapper });
    expect(getAttendanceRoster).not.toHaveBeenCalled();

    await act(async () => {
      resetSessionForTests(); // no school selected
    });
    await renderHook(() => useAttendanceRoster(QUERY), { wrapper });
    expect(getAttendanceRoster).not.toHaveBeenCalled();
  });

  it('does not refetch inside the Daily window', async () => {
    selectTenant('t1');
    client.setQueryData(attendanceRosterKey('t1', QUERY), roster('Cached'));
    const { result } = await renderHook(() => useAttendanceRoster(QUERY), { wrapper });

    expect(result.current.data?.rows[0]?.fullName).toBe('Cached');
    expect(getAttendanceRoster).not.toHaveBeenCalled();
  });
});

describe('useAttendanceSettings', () => {
  it('reads the school status settings once and keeps them for the Reference window', async () => {
    selectTenant('t1');
    const { result } = await renderHook(() => useAttendanceSettings(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(SETTINGS));

    await renderHook(() => useAttendanceSettings(), { wrapper });
    expect(getAttendanceSettings).toHaveBeenCalledTimes(1);
  });
});
