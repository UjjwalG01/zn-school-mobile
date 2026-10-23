import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ApiError, NETWORK_ERROR_CODE } from '../../../../api/errors';
import { getTeacherMyClasses } from '../../../../api/portal';
import { getTenantSettings } from '../../../../api/settings';
import { getMySchools } from '../../../../api/tenancy';
import type { TeacherMyClasses } from '../../../../api/types/portal';
import { resetSessionForTests, selectTenant } from '../../../../auth/session';
import { todayIso } from '../../../../lib/date';
import { tenantSettingsKey } from '../../../queries';
import { teacherMyClassesKey } from '../../queries';
import ClassListScreen from '../ClassListScreen';

const mockPush = jest.fn();
const mockRedirect = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  Redirect: ({ href }: { href: unknown }) => {
    mockRedirect(href);
    return null;
  },
}));
jest.mock('../../../../api/portal');
jest.mock('../../../../api/settings');
jest.mock('../../../../api/tenancy');

const TWO_CLASSES: TeacherMyClasses = {
  restricted: true,
  classes: [
    { classId: 'c8', className: 'Class 8', sectionId: 's8', sectionName: 'A' },
    { classId: 'c6', className: 'Class 6', sectionId: null, sectionName: null },
  ],
  subjects: [],
};

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeEach(() => {
  resetSessionForTests();
  selectTenant('t1');
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  jest.mocked(getTeacherMyClasses).mockResolvedValue(TWO_CLASSES);
  jest.mocked(getMySchools).mockResolvedValue([]);
  jest.mocked(getTenantSettings).mockResolvedValue({ calendarPreference: 'gregorian' });
});

afterEach(() => {
  client.clear();
  jest.clearAllMocks();
});

describe('Attendance class list', () => {
  it('lists the classes the teacher can mark, without a section suffix for a class with none', async () => {
    await render(<ClassListScreen />, { wrapper });

    await waitFor(() => expect(screen.getByText('Class 8 · A')).toBeTruthy());
    expect(screen.getByText('Class 6')).toBeTruthy();
    expect(getTeacherMyClasses).toHaveBeenCalledWith(todayIso());
    expect(screen.queryByText('You can mark any class')).toBeNull();
  });

  it('opens the roster of the pressed class, naming the section only when there is one', async () => {
    await render(<ClassListScreen />, { wrapper });
    const user = userEvent.setup();

    await user.press(await screen.findByRole('button', { name: 'Open attendance for Class 8 · A' }));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/teacher/attendance/roster',
      params: { classId: 'c8', sectionId: 's8' },
    });

    await user.press(screen.getByRole('button', { name: 'Open attendance for Class 6' }));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/teacher/attendance/roster',
      params: { classId: 'c6' },
    });
  });

  it('says a restricted:false teacher can mark any class', async () => {
    jest.mocked(getTeacherMyClasses).mockResolvedValue({ ...TWO_CLASSES, restricted: false });
    await render(<ClassListScreen />, { wrapper });

    await waitFor(() => expect(screen.getByText('You can mark any class')).toBeTruthy());
  });

  it('skips the list and opens the roster when there is exactly one class to mark', async () => {
    jest.mocked(getTeacherMyClasses).mockResolvedValue({
      ...TWO_CLASSES,
      classes: [TWO_CLASSES.classes[0]!],
    });
    await render(<ClassListScreen />, { wrapper });

    await waitFor(() =>
      expect(mockRedirect).toHaveBeenCalledWith({
        pathname: '/teacher/attendance/roster',
        params: { classId: 'c8', sectionId: 's8' },
      }),
    );
    expect(screen.queryByText('Class 8 · A')).toBeNull();
  });

  it('shows the empty state', async () => {
    jest.mocked(getTeacherMyClasses).mockResolvedValue({ restricted: true, classes: [], subjects: [] });
    await render(<ClassListScreen />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText('No classes assigned. Ask your school to assign you.')).toBeTruthy(),
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('says there is no access on a 403', async () => {
    jest.mocked(getTeacherMyClasses).mockRejectedValue(new ApiError(403, 'No access'));
    await render(<ClassListScreen />, { wrapper });

    await waitFor(() => expect(screen.getByText("You don't have access to this section.")).toBeTruthy());
  });

  it('makes no request when the classes are already cached (Home loaded them)', async () => {
    client.setQueryData(teacherMyClassesKey('t1', todayIso()), TWO_CLASSES);
    await render(<ClassListScreen />, { wrapper });

    expect(screen.getByText('Class 8 · A')).toBeTruthy();
    expect(getTeacherMyClasses).not.toHaveBeenCalled();
  });

  it('keeps the cached list and says it is saved data when a refresh fails offline', async () => {
    client.setQueryData(tenantSettingsKey('t1'), { calendarPreference: 'gregorian' });
    client.setQueryData(teacherMyClassesKey('t1', todayIso()), TWO_CLASSES, {
      updatedAt: Date.now() - 60 * 60 * 1000,
    });
    jest.mocked(getTeacherMyClasses).mockRejectedValue(new ApiError(0, 'offline', NETWORK_ERROR_CODE));
    await render(<ClassListScreen />, { wrapper });

    await waitFor(() => expect(screen.getByText(/Showing saved data from/)).toBeTruthy());
    expect(screen.getByText('Class 8 · A')).toBeTruthy();
  });
});
