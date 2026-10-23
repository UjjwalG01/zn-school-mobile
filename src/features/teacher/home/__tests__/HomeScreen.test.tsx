import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ApiError, NETWORK_ERROR_CODE } from '../../../../api/errors';
import { getMe } from '../../../../api/identity';
import { getTeacherExams, getTeacherMyClasses } from '../../../../api/portal';
import { getMobileModules, getTenantSettings } from '../../../../api/settings';
import { getMyPermissions, getMySchools } from '../../../../api/tenancy';
import type { Me } from '../../../../api/types/identity';
import type { TeacherExam, TeacherMyClasses } from '../../../../api/types/portal';
import type { MobileModuleToggle } from '../../../../api/types/settings';
import type { School } from '../../../../api/types/tenancy';
import { meKey, myPermissionsKey, mySchoolsKey } from '../../../../auth/queries';
import { resetSessionForTests, selectTenant } from '../../../../auth/session';
import { type CalendarPreference, todayIso } from '../../../../lib/date';
import { mobileModulesKey, tenantSettingsKey } from '../../../queries';
import { teacherExamsKey, teacherMyClassesKey } from '../../queries';
import HomeScreen from '../HomeScreen';

jest.mock('../../../../api/identity');
jest.mock('../../../../api/portal');
jest.mock('../../../../api/settings');
jest.mock('../../../../api/tenancy');
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../../../../auth/useSchoolSwitch', () => ({
  useSchoolSwitch: () => ({ canSwitch: false, openPicker: jest.fn() }),
}));
jest.mock('../../../../auth/useSignOut', () => ({ useSignOut: () => jest.fn() }));

const ME: Me = {
  id: 'u1',
  email: 'sita@school.test',
  phone: null,
  fullName: 'Sita Sharma',
  isPlatformAdmin: false,
  sessionTimeoutMinutes: 30,
};

const school = (modules: string[]): School => ({
  tenantId: 't1',
  name: 'Everest School',
  status: 'active',
  license: { status: 'active', tierName: null, validUntil: null, expiringSoon: false, modules },
});

const placement = (n: number) => ({
  classId: `c${n}`,
  className: `Class ${n}`,
  sectionId: `s${n}`,
  sectionName: 'A',
});

const MY_CLASSES: TeacherMyClasses = {
  restricted: true,
  classes: [
    { classId: 'c8', className: 'Class 8', sectionId: 's8', sectionName: 'A' },
    { classId: 'c6', className: 'Class 6', sectionId: null, sectionName: null },
  ],
  subjects: [
    {
      classId: 'c8',
      className: 'Class 8',
      sectionId: 's8',
      sectionName: 'A',
      subjectOfferingId: 'o1',
      subjectName: 'Mathematics',
    },
  ],
};

const subject = (id: string, name: string, status: 'draft' | 'submitted' | 'returned' | null) => ({
  examSubjectId: id,
  subjectName: name,
  sectionId: 's8',
  sectionName: 'A',
  components: [],
  submission: status && { status, version: 1, returnedReason: null, submittedAt: null },
});

const EXAMS: TeacherExam[] = [
  {
    examId: 'e1',
    name: 'Second Terminal',
    sessionName: '2083',
    classId: 'c-class-8',
    className: 'Class 8',
    sectionId: 's8',
    sectionName: 'A',
    subjects: [
      subject('x1', 'Mathematics', 'returned'),
      subject('x2', 'Science', null),
      subject('x3', 'English', 'submitted'),
    ],
  },
];

interface Seed {
  permissions?: string[];
  modules?: string[];
  mobileModules?: MobileModuleToggle[];
  calendar?: CalendarPreference | null;
}

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

/** Context queries come pre-cached (the resolve gate has loaded them before the shell opens). */
function seed({
  permissions = ['attendance.mark', 'exam_result.save'],
  modules = ['academic'],
  mobileModules = [],
  calendar = 'gregorian',
}: Seed = {}) {
  client.setQueryData(meKey(), ME);
  client.setQueryData(mySchoolsKey(), [school(modules)]);
  client.setQueryData(myPermissionsKey('t1'), { all: false, keys: permissions });
  client.setQueryData(mobileModulesKey('t1'), mobileModules);
  if (calendar) client.setQueryData(tenantSettingsKey('t1'), { calendarPreference: calendar });
}

beforeEach(() => {
  resetSessionForTests();
  selectTenant('t1');
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  jest.mocked(getTeacherMyClasses).mockResolvedValue(MY_CLASSES);
  jest.mocked(getTeacherExams).mockResolvedValue(EXAMS);
  jest.mocked(getMe).mockResolvedValue(ME);
  jest.mocked(getMySchools).mockResolvedValue([school(['academic'])]);
  jest.mocked(getMyPermissions).mockResolvedValue({ all: false, keys: [] });
  jest.mocked(getMobileModules).mockResolvedValue([]);
  jest.mocked(getTenantSettings).mockResolvedValue({ calendarPreference: 'gregorian' });
});

afterEach(() => {
  client.clear(); // release gc timers so Jest can exit
  jest.clearAllMocks();
});

describe('teacher Home', () => {
  it('shows the greeting, school, date, classes, exams with progress, and subjects', async () => {
    seed();
    await render(<HomeScreen />, { wrapper });

    expect(screen.getByText('Hello, Sita Sharma')).toBeTruthy();
    expect(screen.getByText('Everest School')).toBeTruthy();
    expect(screen.getByText(new RegExp(todayIso()))).toBeTruthy();

    await waitFor(() => expect(screen.getByText('Class 8 · A')).toBeTruthy());
    expect(screen.getByText('Attendance')).toBeTruthy();
    expect(screen.getByText('Class 6')).toBeTruthy(); // a class with no sections has no " · section"

    await waitFor(() => expect(screen.getByText('Second Terminal')).toBeTruthy());
    expect(screen.getByText('2083 · Class 8 · A')).toBeTruthy();
    expect(screen.getByText('Returned')).toBeTruthy();
    expect(screen.getByText('Not started')).toBeTruthy();
    expect(screen.getByText('Submitted')).toBeTruthy();
    expect(screen.getByText('Returned for correction: 1')).toBeTruthy();

    expect(screen.getByText('My subjects')).toBeTruthy();
    expect(screen.getByText('Mathematics — Class 8 · A')).toBeTruthy();
    // Sign out and Switch school moved to the Profile tab.
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
  });

  it('shows summary tiles from the cached reads, and no shortcut block (the tab bar is the way to the other tabs)', async () => {
    seed({ permissions: ['attendance.mark', 'attendance.self', 'exam_result.save'] });
    await render(<HomeScreen />, { wrapper });

    await waitFor(() => expect(screen.getByLabelText('Classes: 2')).toBeTruthy());
    expect(screen.getByLabelText('Subjects: 1')).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText('Open exams: 1')).toBeTruthy());
    expect(screen.queryByText('Shortcuts')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Take attendance' })).toBeNull();
  });

  it('shows no exams tile for a teacher who cannot see exams', async () => {
    seed({ permissions: [], modules: ['fees'] });
    await render(<HomeScreen />, { wrapper });

    await waitFor(() => expect(screen.getByLabelText('Classes: 2')).toBeTruthy());
    expect(screen.queryByLabelText(/^Open exams/)).toBeNull();
  });

  it('does not guess a calendar before the tenant settings are known', async () => {
    seed({ calendar: null });
    jest.mocked(getTenantSettings).mockReturnValue(new Promise(() => undefined));
    await render(<HomeScreen />, { wrapper });
    await waitFor(() => expect(screen.getByText('Class 8 · A')).toBeTruthy());
    expect(screen.queryByText(new RegExp(todayIso()))).toBeNull();
  });

  it('says a restricted:false teacher can mark any class, and caps the list at 5', async () => {
    seed();
    jest.mocked(getTeacherMyClasses).mockResolvedValue({
      restricted: false,
      classes: [1, 2, 3, 4, 5, 6, 7].map(placement),
      subjects: [],
    });
    await render(<HomeScreen />, { wrapper });

    await waitFor(() => expect(screen.getByText('You can mark any class')).toBeTruthy());
    expect(screen.getByText('Class 5 · A')).toBeTruthy();
    expect(screen.queryByText('Class 6 · A')).toBeNull();
    expect(screen.getByText('+2 more')).toBeTruthy();
  });

  it('opens the Attendance tab from the "+N more" under Attendance', async () => {
    seed();
    jest.mocked(getTeacherMyClasses).mockResolvedValue({
      restricted: true,
      classes: [1, 2, 3, 4, 5, 6, 7].map(placement),
      subjects: [],
    });
    await render(<HomeScreen />, { wrapper });

    const more = await screen.findByRole('button', { name: '+2 more' });
    await userEvent.setup().press(more);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/teacher/attendance', params: { subtab: 'students' } });
  });

  it("opens a class's roster when its card is pressed, naming the section only when there is one", async () => {
    seed();
    await render(<HomeScreen />, { wrapper });
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

  const manySubjects = [1, 2, 3, 4, 5, 6, 7].map((n) => ({
    ...placement(n),
    subjectOfferingId: `o${n}`,
    subjectName: `Subject ${n}`,
  }));

  it('turns the "+N more" under My subjects into a link to My classes when that tab is available', async () => {
    seed();
    jest.mocked(getTeacherMyClasses).mockResolvedValue({ restricted: true, classes: [], subjects: manySubjects });
    await render(<HomeScreen />, { wrapper });

    const more = await screen.findByRole('button', { name: '+2 more' });
    await userEvent.setup().press(more);
    expect(mockPush).toHaveBeenCalledWith('/teacher/academic/assignments');
  });

  it('keeps that "+N more" as plain text when the school turned My classes off for mobile', async () => {
    seed({ mobileModules: [{ moduleKey: 'my_classes', visible: false }] });
    jest.mocked(getTeacherMyClasses).mockResolvedValue({ restricted: true, classes: [], subjects: manySubjects });
    await render(<HomeScreen />, { wrapper });

    await waitFor(() => expect(screen.getByText('+2 more')).toBeTruthy());
    expect(screen.queryByRole('button', { name: '+2 more' })).toBeNull();
  });

  it('shows the empty states', async () => {
    seed();
    jest.mocked(getTeacherMyClasses).mockResolvedValue({ restricted: true, classes: [], subjects: [] });
    jest.mocked(getTeacherExams).mockResolvedValue([]);
    await render(<HomeScreen />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText('No classes assigned. Ask your school to assign you.')).toBeTruthy(),
    );
    expect(screen.getByText('No subjects assigned.')).toBeTruthy();
    expect(screen.getByText('No exams are open for marks entry.')).toBeTruthy();
    expect(screen.queryByText(/Returned for correction/)).toBeNull();
  });

  it('hides the Marks section entirely when exams answers 403 (no staff link)', async () => {
    seed();
    jest.mocked(getTeacherExams).mockRejectedValue(new ApiError(403, 'No access'));
    await render(<HomeScreen />, { wrapper });

    await waitFor(() => expect(screen.queryByText('Marks entry')).toBeNull());
    expect(getTeacherExams).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Attendance')).toBeTruthy();
  });

  it('hides Attendance without attendance.mark, and still shows Marks', async () => {
    seed({ permissions: ['exam_result.save'] });
    await render(<HomeScreen />, { wrapper });

    await waitFor(() => expect(screen.getByText('Second Terminal')).toBeTruthy());
    expect(screen.queryByText('Attendance')).toBeNull();
    expect(screen.queryByText('Classes you can mark today')).toBeNull();
  });

  it('does not even request exams when the school turned the exams module off for mobile', async () => {
    seed({ mobileModules: [{ moduleKey: 'exams', visible: false }] });
    await render(<HomeScreen />, { wrapper });

    await waitFor(() => expect(screen.getByText('Class 8 · A')).toBeTruthy());
    expect(screen.queryByText('Marks entry')).toBeNull();
    expect(getTeacherExams).not.toHaveBeenCalled();
  });

  it('keeps showing cached data with a saved-data banner when a refresh fails offline', async () => {
    seed();
    const anHourAgo = Date.now() - 60 * 60 * 1000;
    client.setQueryData(teacherMyClassesKey('t1', todayIso()), MY_CLASSES, { updatedAt: anHourAgo });
    client.setQueryData(teacherExamsKey('t1'), EXAMS, { updatedAt: anHourAgo });
    jest.mocked(getTeacherMyClasses).mockRejectedValue(new ApiError(0, 'offline', NETWORK_ERROR_CODE));
    jest.mocked(getTeacherExams).mockRejectedValue(new ApiError(0, 'offline', NETWORK_ERROR_CODE));
    await render(<HomeScreen />, { wrapper });

    await waitFor(() => expect(screen.getByText(/Showing saved data from/)).toBeTruthy());
    expect(screen.getByText('Class 8 · A')).toBeTruthy();
    expect(screen.getByText('Second Terminal')).toBeTruthy();
    expect(screen.queryByText(/Could not reach the server/)).toBeNull();
    expect(screen.queryByText(/^Updated/)).toBeNull();
  });

  it('shows an error with retry when there is nothing cached', async () => {
    seed();
    jest.mocked(getTeacherMyClasses).mockRejectedValue(new ApiError(500, 'boom'));
    await render(<HomeScreen />, { wrapper });

    await waitFor(() => expect(screen.getAllByText('Could not load this section.').length).toBeGreaterThan(0));
    expect(screen.getAllByRole('button', { name: 'Try again' }).length).toBeGreaterThan(0);
  });

  it('says there is no access when my-classes answers 403, once', async () => {
    seed();
    jest.mocked(getTeacherMyClasses).mockRejectedValue(new ApiError(403, 'No access'));
    await render(<HomeScreen />, { wrapper });

    await waitFor(() => expect(screen.getByText("You don't have access to this section.")).toBeTruthy());
    expect(screen.getAllByText("You don't have access to this section.")).toHaveLength(1);
    expect(screen.queryByText('My subjects')).toBeNull();
  });

  it('refreshes my-schools once and hides the sections when the license no longer covers them', async () => {
    seed();
    jest
      .mocked(getTeacherMyClasses)
      .mockRejectedValue(new ApiError(403, 'Not licensed', 'ENTITLEMENT_DENIED'));
    await render(<HomeScreen />, { wrapper });

    await waitFor(() => expect(getMySchools).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText('Attendance')).toBeNull());
    expect(screen.queryByText('My subjects')).toBeNull();
  });

  it('pull-to-refresh re-requests both lists and shows when it was last updated', async () => {
    seed();
    await render(<HomeScreen />, { wrapper });
    await waitFor(() => expect(screen.getByText('Second Terminal')).toBeTruthy());
    expect(screen.getByText(/^Updated/)).toBeTruthy();
    expect(getTeacherMyClasses).toHaveBeenCalledTimes(1);
    expect(getTeacherExams).toHaveBeenCalledTimes(1);

    const user = userEvent.setup();
    const scrollView = screen.root!.queryAll((node) => node.type === 'RCTScrollView')[0]!;
    await user.pullToRefresh(scrollView);

    await waitFor(() => expect(getTeacherMyClasses).toHaveBeenCalledTimes(2));
    expect(getTeacherExams).toHaveBeenCalledTimes(2);
  });
});
