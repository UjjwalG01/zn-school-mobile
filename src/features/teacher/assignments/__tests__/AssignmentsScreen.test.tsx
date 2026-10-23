import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ApiError, NETWORK_ERROR_CODE } from '../../../../api/errors';
import { getTeacherMyClasses } from '../../../../api/portal';
import { getTenantSettings } from '../../../../api/settings';
import { getMySchools } from '../../../../api/tenancy';
import type { TeacherMyClasses } from '../../../../api/types/portal';
import { mySchoolsKey, useMySchools } from '../../../../auth/queries';
import { resetSessionForTests, selectTenant } from '../../../../auth/session';
import { todayIso } from '../../../../lib/date';
import { tenantSettingsKey } from '../../../queries';
import { teacherMyClassesKey } from '../../queries';
import AssignmentsScreen from '../AssignmentsScreen';

jest.mock('../../../../api/portal');
jest.mock('../../../../api/settings');
jest.mock('../../../../api/tenancy');

const placement = (n: number) => ({
  classId: `c${n}`,
  className: `Class ${n}`,
  sectionId: `s${n}`,
  sectionName: 'A',
});

const MY_CLASSES: TeacherMyClasses = {
  restricted: true,
  classes: [placement(8), { classId: 'c6', className: 'Class 6', sectionId: null, sectionName: null }],
  subjects: [{ ...placement(8), subjectOfferingId: 'o1', subjectName: 'Mathematics' }],
};

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeEach(() => {
  resetSessionForTests();
  selectTenant('t1');
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  jest.mocked(getTeacherMyClasses).mockResolvedValue(MY_CLASSES);
  jest.mocked(getMySchools).mockResolvedValue([]);
  jest.mocked(getTenantSettings).mockResolvedValue({ calendarPreference: 'gregorian' });
});

afterEach(() => {
  client.clear(); // release gc timers so Jest can exit
  jest.clearAllMocks();
});

describe('My classes', () => {
  it('lists every class and subject, without a section suffix for a class with none', async () => {
    await render(<AssignmentsScreen />, { wrapper });

    await waitFor(() => expect(screen.getByText('Class 8 · A')).toBeTruthy());
    expect(screen.getByText('Classes')).toBeTruthy();
    expect(screen.getByText('Class 6')).toBeTruthy();
    expect(screen.getByText('Subjects')).toBeTruthy();
    expect(screen.getByText('Mathematics — Class 8 · A')).toBeTruthy();
    expect(screen.queryByText('You can mark any class')).toBeNull();
    expect(getTeacherMyClasses).toHaveBeenCalledWith(todayIso());
  });

  it('shows the whole list, not the Home cap of 5', async () => {
    jest.mocked(getTeacherMyClasses).mockResolvedValue({
      restricted: false,
      classes: [1, 2, 3, 4, 5, 6, 7].map(placement),
      subjects: [],
    });
    await render(<AssignmentsScreen />, { wrapper });

    await waitFor(() => expect(screen.getByText('You can mark any class')).toBeTruthy());
    expect(screen.getByText('Class 1 · A')).toBeTruthy();
    expect(screen.getByText('Class 7 · A')).toBeTruthy(); // virtualized, but the first screenful holds 7 short rows
    expect(screen.queryByText(/more$/)).toBeNull();
  });

  it('shows each empty section with its own text', async () => {
    jest.mocked(getTeacherMyClasses).mockResolvedValue({ restricted: true, classes: [], subjects: [] });
    await render(<AssignmentsScreen />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText('No classes assigned. Ask your school to assign you.')).toBeTruthy(),
    );
    expect(screen.getByText('No subjects assigned.')).toBeTruthy();
  });

  it('says there is no access on a 403, and offers a retry on a server error', async () => {
    jest.mocked(getTeacherMyClasses).mockRejectedValue(new ApiError(403, 'No access'));
    const { unmount } = await render(<AssignmentsScreen />, { wrapper });
    await waitFor(() => expect(screen.getByText("You don't have access to this section.")).toBeTruthy());
    expect(screen.queryByRole('button')).toBeNull();
    await unmount();

    client.clear();
    jest.mocked(getTeacherMyClasses).mockRejectedValue(new ApiError(500, 'boom'));
    await render(<AssignmentsScreen />, { wrapper });
    await waitFor(() => expect(screen.getByText('Could not load this section.')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('keeps showing cached classes when a refresh fails offline', async () => {
    client.setQueryData(tenantSettingsKey('t1'), { calendarPreference: 'gregorian' });
    client.setQueryData(teacherMyClassesKey('t1', todayIso()), MY_CLASSES, {
      updatedAt: Date.now() - 60 * 60 * 1000,
    });
    jest.mocked(getTeacherMyClasses).mockRejectedValue(new ApiError(0, 'offline', NETWORK_ERROR_CODE));
    await render(<AssignmentsScreen />, { wrapper });

    await waitFor(() => expect(getTeacherMyClasses).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Class 8 · A')).toBeTruthy();
    expect(screen.queryByText(/Could not reach the server/)).toBeNull();
  });

  it('says the cached list is saved data, and from when, when a refresh fails offline', async () => {
    client.setQueryData(tenantSettingsKey('t1'), { calendarPreference: 'gregorian' });
    client.setQueryData(teacherMyClassesKey('t1', todayIso()), MY_CLASSES, {
      updatedAt: Date.now() - 60 * 60 * 1000,
    });
    jest.mocked(getTeacherMyClasses).mockRejectedValue(new ApiError(0, 'offline', NETWORK_ERROR_CODE));
    await render(<AssignmentsScreen />, { wrapper });

    await waitFor(() => expect(screen.getByText(/Showing saved data from/)).toBeTruthy());
    expect(screen.getByText('Class 8 · A')).toBeTruthy();
  });

  it('shows no saved-data note, and reads no settings, while online', async () => {
    await render(<AssignmentsScreen />, { wrapper });

    await waitFor(() => expect(screen.getByText('Class 8 · A')).toBeTruthy());
    expect(screen.queryByText(/Showing saved data/)).toBeNull();
    expect(getTenantSettings).not.toHaveBeenCalled();
  });

  it('refreshes my-schools once when the license no longer covers the feature', async () => {
    jest
      .mocked(getTeacherMyClasses)
      .mockRejectedValue(new ApiError(403, 'Not licensed', 'ENTITLEMENT_DENIED'));
    // In the app the tab layout observes my-schools; invalidation only refetches active queries.
    function SchoolsObserver() {
      useMySchools();
      return null;
    }
    client.setQueryData(mySchoolsKey(), []);
    await render(
      <>
        <SchoolsObserver />
        <AssignmentsScreen />
      </>,
      { wrapper },
    );

    await waitFor(() => expect(getMySchools).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Classes')).toBeNull();
  });

  it('pull-to-refresh re-requests my-classes', async () => {
    await render(<AssignmentsScreen />, { wrapper });
    await waitFor(() => expect(screen.getByText('Class 8 · A')).toBeTruthy());
    expect(getTeacherMyClasses).toHaveBeenCalledTimes(1);

    const scrollView = screen.root!.queryAll((node) => node.type === 'RCTScrollView')[0]!;
    await userEvent.setup().pullToRefresh(scrollView);

    await waitFor(() => expect(getTeacherMyClasses).toHaveBeenCalledTimes(2));
  });
});
