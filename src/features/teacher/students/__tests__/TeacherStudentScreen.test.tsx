import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Linking } from 'react-native';

import { removeTenantQueries } from '../../../../api/queryKeys';
import { ApiError, NETWORK_ERROR_CODE } from '../../../../api/errors';
import { getTeacherStudent } from '../../../../api/portal';
import { getTenantSettings } from '../../../../api/settings';
import { getMySchools } from '../../../../api/tenancy';
import type { TeacherStudent } from '../../../../api/types/portal';
import { resetSessionForTests, selectTenant } from '../../../../auth/session';
import { formatDate } from '../../../../lib/date';
import { shouldPersistQuery } from '../../../../lib/queryClient';
import { getToast, resetToastForTests } from '../../../../lib/toast';
import { tenantSettingsKey } from '../../../queries';
import { teacherStudentKey } from '../queries';
import TeacherStudentScreen from '../TeacherStudentScreen';

let mockParams: Record<string, string | undefined> = {};
const mockTitle = jest.fn();
jest.mock('expo-router', () => ({
  Stack: {
    Screen: ({ options }: { options: { title?: string } }) => {
      mockTitle(options.title);
      return null;
    },
  },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('../../../../api/portal');
jest.mock('../../../../api/settings');
jest.mock('../../../../api/tenancy');

const STUDENT: TeacherStudent = {
  student: {
    id: 'st-1',
    admissionNumber: 'STU-2026-0006',
    fullName: 'Dipesh Gurung',
    dateOfBirth: '2010-01-01',
    gender: 'female',
    bloodGroup: 'O+',
    status: 'active',
  },
  guardians: [
    { guardianId: 'g-1', fullName: 'Sita Gurung', phone: '+977 9800000000', relationship: 'mother', isPrimary: true },
    { guardianId: 'g-2', fullName: 'Ram Gurung', phone: null, relationship: 'father', isPrimary: false },
  ],
  enrollments: [
    { id: 'en-0', academicYearLabel: '2081/82', className: 'Class 5', sectionName: 'B', status: 'promoted', rollNumber: '7' },
    { id: 'en-1', academicYearLabel: '2082/83', className: 'Class 6', sectionName: 'A', status: 'active', rollNumber: '3' },
  ],
};

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeEach(() => {
  resetSessionForTests();
  resetToastForTests();
  selectTenant('t1');
  mockParams = { studentId: 'st-1' };
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  jest.mocked(getTeacherStudent).mockResolvedValue(STUDENT);
  jest.mocked(getTenantSettings).mockResolvedValue({ calendarPreference: 'gregorian' });
  jest.mocked(getMySchools).mockResolvedValue([]);
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

afterEach(async () => {
  await waitFor(() => expect(client.isFetching()).toBe(0));
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
  client.clear();
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

async function openStudent() {
  await render(<TeacherStudentScreen />, { wrapper });
  await screen.findByText('Dipesh Gurung');
}

describe('a student the backend allowed', () => {
  it('asks for that student and titles the screen with the name', async () => {
    await openStudent();

    expect(getTeacherStudent).toHaveBeenCalledWith('st-1');
    await waitFor(() => expect(mockTitle).toHaveBeenLastCalledWith('Dipesh Gurung'));
  });

  it('shows admission number, status, current class and roll first, and earlier years below', async () => {
    await openStudent();

    expect(screen.getByText('Admission number: STU-2026-0006')).toBeTruthy();
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.getByText('2082/83 · Class 6 · A · Roll 3')).toBeTruthy();
    expect(screen.getByText('Earlier years')).toBeTruthy();
    expect(screen.getByText('2081/82 · Class 5 · B · Roll 7')).toBeTruthy();
    expect(screen.getByText('Promoted')).toBeTruthy();
  });

  it('shows date of birth in the school calendar, gender and blood group', async () => {
    await openStudent();

    await waitFor(() => expect(screen.getByText(formatDate('2010-01-01', 'gregorian'))).toBeTruthy());
    expect(screen.getByText('Female')).toBeTruthy();
    expect(screen.getByText('O+')).toBeTruthy();
  });

  it('shows missing details as a dash, never as a guess', async () => {
    jest.mocked(getTeacherStudent).mockResolvedValue({
      ...STUDENT,
      student: { ...STUDENT.student, dateOfBirth: null, gender: null, bloodGroup: null },
    });
    await openStudent();

    expect(screen.getAllByText('—')).toHaveLength(3);
  });

  it('lists each guardian with relationship and a Primary marker, and shows no e-mail', async () => {
    await openStudent();

    expect(screen.getByText('Sita Gurung · Mother')).toBeTruthy();
    expect(screen.getByText('Ram Gurung · Father')).toBeTruthy();
    expect(screen.getAllByText('Primary')).toHaveLength(1);
    expect(screen.queryByText(/@/)).toBeNull();
  });

  it('offers a call only for a guardian with a phone, and dials the number without its spaces', async () => {
    await openStudent();
    const user = userEvent.setup();

    expect(screen.getAllByRole('button', { name: /^Call / })).toHaveLength(1);
    await user.press(screen.getByRole('button', { name: 'Call +977 9800000000' }));

    expect(Linking.openURL).toHaveBeenCalledWith('tel:+9779800000000');
  });

  it('says so when the phone cannot start the call', async () => {
    jest.mocked(Linking.openURL).mockRejectedValue(new Error('no dialer'));
    await openStudent();
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Call +977 9800000000' }));

    await waitFor(() => expect(getToast()).toMatchObject({ message: "Couldn't start the call.", tone: 'error' }));
  });

  it('says there is no guardian on record when there are none', async () => {
    jest.mocked(getTeacherStudent).mockResolvedValue({ ...STUDENT, guardians: [] });
    await openStudent();

    expect(screen.getByText('No guardian on record.')).toBeTruthy();
  });

  it('shows an unknown status as returned', async () => {
    jest.mocked(getTeacherStudent).mockResolvedValue({
      ...STUDENT,
      student: { ...STUDENT.student, status: 'on_hold' },
    });
    await openStudent();

    expect(screen.getByText('on_hold')).toBeTruthy();
  });
});

describe('when the student cannot be shown', () => {
  it('says there is no access on the 403 that an outsider, an unlinked account and a missing id all get', async () => {
    jest.mocked(getTeacherStudent).mockRejectedValue(new ApiError(403, 'This student is not in a class or section you teach'));
    await render(<TeacherStudentScreen />, { wrapper });

    expect(await screen.findByText("You don't have access to this student.")).toBeTruthy();
    expect(screen.queryByText('Dipesh Gurung')).toBeNull();
  });

  it('says not found on the 404 an attendance.mark_any holder gets for a missing id', async () => {
    jest.mocked(getTeacherStudent).mockRejectedValue(new ApiError(404, 'Student not found'));
    await render(<TeacherStudentScreen />, { wrapper });

    expect(await screen.findByText('Student not found.')).toBeTruthy();
  });

  it('says not found, and asks for nothing, when the link has no student id', async () => {
    mockParams = {};
    await render(<TeacherStudentScreen />, { wrapper });

    expect(await screen.findByText('Student not found.')).toBeTruthy();
    expect(getTeacherStudent).not.toHaveBeenCalled();
  });

  it('says details are not saved on the phone when offline with nothing in memory', async () => {
    jest.mocked(getTeacherStudent).mockRejectedValue(new ApiError(0, 'offline', NETWORK_ERROR_CODE));
    await render(<TeacherStudentScreen />, { wrapper });

    expect(await screen.findByText('You are offline. Student details are not saved on this phone.')).toBeTruthy();
  });

  it('offers a retry on a server error', async () => {
    jest.mocked(getTeacherStudent).mockRejectedValueOnce(new ApiError(500, 'boom'));
    await render(<TeacherStudentScreen />, { wrapper });
    const user = userEvent.setup();

    await user.press(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Dipesh Gurung')).toBeTruthy();
    expect(getTeacherStudent).toHaveBeenCalledTimes(2);
  });

  it('keeps showing the student, with the saved-data note, when a refresh fails offline', async () => {
    client.setQueryData(tenantSettingsKey('t1'), { calendarPreference: 'gregorian' });
    client.setQueryData(teacherStudentKey('t1', 'st-1'), STUDENT, { updatedAt: Date.now() - 3_600_000 });
    jest.mocked(getTeacherStudent).mockRejectedValue(new ApiError(0, 'offline', NETWORK_ERROR_CODE));
    await render(<TeacherStudentScreen />, { wrapper });

    await waitFor(() => expect(screen.getByText(/Showing saved data from/)).toBeTruthy());
    expect(screen.getByText('Dipesh Gurung')).toBeTruthy();
  });
});

describe('what stays on the phone', () => {
  it('keeps the student out of the persisted cache (other people’s phone numbers and health data)', async () => {
    await openStudent();

    const query = client.getQueryCache().find({ queryKey: teacherStudentKey('t1', 'st-1') })!;
    expect(query.state.status).toBe('success');
    expect(shouldPersistQuery(query)).toBe(false);
  });

  it('is removed with the rest of the school on a school switch, and only that school', async () => {
    await openStudent();
    client.setQueryData(teacherStudentKey('t2', 'st-1'), STUDENT);

    removeTenantQueries(client, 't1');

    expect(client.getQueryData(teacherStudentKey('t1', 'st-1'))).toBeUndefined();
    expect(client.getQueryData(teacherStudentKey('t2', 'st-1'))).toBeDefined();
  });

  it('uses a key that starts with the school and names the student', () => {
    expect(teacherStudentKey('t1', 'st-1')).toEqual(['t1', 'teacher', 'student', 'st-1']);
  });
});
