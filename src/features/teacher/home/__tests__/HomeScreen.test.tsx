import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { getAttendanceSettings, getMyAttendance } from '../../../../api/attendance';
import { getCalendar, getNotices } from '../../../../api/calendar';
import { ApiError, NETWORK_ERROR_CODE } from '../../../../api/errors';
import { getMe } from '../../../../api/identity';
import { getTeacherExams, getTeacherMyClasses } from '../../../../api/portal';
import { getMobileModules, getTenantSettings } from '../../../../api/settings';
import { getMyPermissions, getMySchools } from '../../../../api/tenancy';
import type { MyAttendance, StaffAttendanceRecord } from '../../../../api/types/attendance';
import type { CalendarFeed, CalendarItem } from '../../../../api/types/calendar';
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

jest.mock('../../../../api/attendance');
jest.mock('../../../../api/calendar');
jest.mock('../../../../api/identity');
jest.mock('../../../../api/portal');
jest.mock('../../../../api/settings');
jest.mock('../../../../api/tenancy');
// A fixed "today" (Friday 23 October 2026), so the calendar's month and upcoming window are known.
jest.mock('../../../../lib/date', () => ({ ...jest.requireActual('../../../../lib/date'), todayIso: () => '2026-10-23' }));
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

const attendanceRecord = (attendanceDate: string, status: StaffAttendanceRecord['status']): StaffAttendanceRecord => ({
  id: `r-${attendanceDate}`,
  attendanceDate,
  status,
  remarks: null,
  source: 'self',
  version: 1,
});

const MY_ATTENDANCE: MyAttendance = {
  staff: { id: 'st1', staffCode: 'T-1', fullName: 'Sita Sharma', employmentStatus: 'active' },
  today: '2026-10-23',
  todayDay: { schoolDay: true, reason: null, holidayName: null },
  month: '2026-10',
  records: [
    attendanceRecord('2026-10-19', 'present'),
    attendanceRecord('2026-10-20', 'present'),
    attendanceRecord('2026-10-21', 'absent'),
    attendanceRecord('2026-10-22', 'half_day'),
  ],
};

const calendarItem = (id: string, title: string, startDate: string): CalendarItem => ({
  kind: 'event',
  id,
  title,
  typeLabel: 'Trip',
  color: 'green',
  startDate,
  endDate: startDate,
  description: null,
});
const CALENDAR_ITEMS = [calendarItem('e1', 'Science fair', '2026-10-23'), calendarItem('e2', 'Parents meeting', '2026-10-28')];

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
  jest.mocked(getMyAttendance).mockResolvedValue(MY_ATTENDANCE);
  jest.mocked(getCalendar).mockImplementation(
    async (from, to): Promise<CalendarFeed> => ({
      from,
      to,
      items: CALENDAR_ITEMS.filter((item) => item.startDate <= to && item.endDate >= from),
      weeklyOff: [6],
    }),
  );
  jest.mocked(getNotices).mockResolvedValue({
    total: 1,
    rows: [{ id: 'n1', title: 'Fee notice', body: 'Please pay before Friday.', publishedAt: '2026-10-21T08:00:00Z' }],
  });
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
  it('shows the school, the date, the summary tiles and the charts, and none of the detail lists', async () => {
    seed();
    await render(<HomeScreen />, { wrapper });

    expect(screen.getByText('EVEREST SCHOOL')).toBeTruthy();
    expect(screen.getByText(new RegExp(todayIso()))).toBeTruthy();

    await waitFor(() => expect(screen.getByLabelText('Classes: 2')).toBeTruthy());
    expect(screen.getByLabelText('Subjects: 1')).toBeTruthy();
    expect(await screen.findByText('Marks entry progress')).toBeTruthy();
    expect(screen.getByText('Subjects by class')).toBeTruthy();
    expect(screen.getByText('Returned for correction: 1')).toBeTruthy();

    // The class cards, the exam cards and the subject list are on their own pages now.
    expect(screen.queryByText('Class 6')).toBeNull();
    expect(screen.queryByText('Second Terminal')).toBeNull();
    expect(screen.queryByText('My subjects')).toBeNull();
    expect(screen.queryByText('Mathematics — Class 8 · A')).toBeNull();
    // Sign out and Switch school moved to the Profile tab.
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
  });

  it('charts the marks entry progress and the subjects per class from the reads it already made', async () => {
    seed();
    await render(<HomeScreen />, { wrapper });

    // EXAMS holds one subject returned, one not started and one submitted.
    expect(await screen.findByText('Marks entry progress')).toBeTruthy();
    expect(screen.getByText('1 of 3 subjects submitted')).toBeTruthy();
    expect(
      screen.getByLabelText('Submitted: 1, Returned: 1, Draft: 0, Not started: 1'),
    ).toBeTruthy();

    // MY_CLASSES gives the teacher one subject, in Class 8 · A.
    expect(screen.getByText('Subjects by class')).toBeTruthy();
    expect(screen.getByLabelText('Class 8 · A: 1')).toBeTruthy();
    // Charting adds no request: the same two reads feed the tiles and the charts.
    expect(getTeacherMyClasses).toHaveBeenCalledTimes(1);
    expect(getTeacherExams).toHaveBeenCalledTimes(1);
  });

  describe('My Attendance This Month', () => {
    const withSelf = () => seed({ permissions: ['attendance.mark', 'attendance.self', 'exam_result.save'] });

    it("charts the teacher's own month by status with one extra request", async () => {
      withSelf();
      await render(<HomeScreen />, { wrapper });

      expect(await screen.findByText('My Attendance This Month')).toBeTruthy();
      expect(await screen.findByText('October 2026')).toBeTruthy();
      // Present and absent are always listed; half day only because the month has one; late and excused have none.
      expect(screen.getByLabelText('Present: 2, Absent: 1, Half day: 1')).toBeTruthy();
      expect(screen.getByText('Days recorded: 4')).toBeTruthy();
      expect(screen.queryByText('Late')).toBeNull();
      // The request is the current month, with no per-day or per-student reads, and it happens once.
      expect(getMyAttendance).toHaveBeenCalledTimes(1);
      expect(getMyAttendance).toHaveBeenCalledWith(undefined);
      expect(getAttendanceSettings).not.toHaveBeenCalled(); // labels are the app's own when the school's were never loaded
    });

    it('uses the school’s own status wording when the settings were already loaded, without loading them', async () => {
      withSelf();
      client.setQueryData(['t1', 'attendance', 'settings'], {
        backdateWindowDays: 7,
        statuses: [
          { status: 'present', label: 'Here', code: 'H', active: true, sortOrder: 1 },
          { status: 'absent', label: 'Gone', code: 'G', active: true, sortOrder: 2 },
          { status: 'half_day', label: 'Half', code: 'HD', active: true, sortOrder: 3 },
        ],
      });
      await render(<HomeScreen />, { wrapper });

      expect(await screen.findByLabelText('Here: 2, Gone: 1, Half: 1')).toBeTruthy();
      expect(getAttendanceSettings).not.toHaveBeenCalled(); // the chart never loads them itself
    });

    it('says so when nothing is recorded this month', async () => {
      withSelf();
      jest.mocked(getMyAttendance).mockResolvedValue({ ...MY_ATTENDANCE, records: [] });
      await render(<HomeScreen />, { wrapper });

      expect(await screen.findByText('My Attendance This Month')).toBeTruthy();
      expect(await screen.findByText('No attendance recorded this month.')).toBeTruthy();
      expect(screen.queryByLabelText(/^Present:/)).toBeNull();
    });

    it('is not requested, or shown, without attendance.self', async () => {
      seed({ permissions: ['attendance.mark', 'exam_result.save'] });
      await render(<HomeScreen />, { wrapper });

      await waitFor(() => expect(screen.getByLabelText('Classes: 2')).toBeTruthy());
      expect(screen.queryByText('My Attendance This Month')).toBeNull();
      expect(getMyAttendance).not.toHaveBeenCalled();
    });

    it('is hidden for an account with no staff record, without hiding the rest of the Dashboard', async () => {
      withSelf();
      jest.mocked(getMyAttendance).mockRejectedValue(new ApiError(404, 'No staff member'));
      await render(<HomeScreen />, { wrapper });

      await waitFor(() => expect(screen.getByLabelText('Classes: 2')).toBeTruthy());
      await waitFor(() => expect(getMyAttendance).toHaveBeenCalled());
      expect(screen.queryByText('My Attendance This Month')).toBeNull();
    });

    it('offers a retry when it cannot be loaded, and re-reads on a pull', async () => {
      withSelf();
      jest.mocked(getMyAttendance).mockRejectedValueOnce(new ApiError(0, 'offline', NETWORK_ERROR_CODE));
      await render(<HomeScreen />, { wrapper });
      const user = userEvent.setup();

      expect(await screen.findByText('My Attendance This Month')).toBeTruthy();
      await user.press(await screen.findByRole('button', { name: 'Try again' }));
      expect(await screen.findByText('Days recorded: 4')).toBeTruthy();
    });

    it('opens the My Attendance subtab of the Attendance tab once loaded', async () => {
      withSelf();
      await render(<HomeScreen />, { wrapper });

      await userEvent.setup().press(await screen.findByRole('button', { name: /^My Attendance This Month/ }));
      expect(mockPush).toHaveBeenCalledWith({ pathname: '/teacher/attendance', params: { subtab: 'self' } });
    });
  });

  it('shows no marks chart without exams, and no subject chart without assignments', async () => {
    seed({ modules: ['fees'], permissions: [] });
    jest.mocked(getTeacherMyClasses).mockResolvedValue({ restricted: true, classes: [], subjects: [] });
    await render(<HomeScreen />, { wrapper });

    await waitFor(() => expect(screen.getByLabelText('Classes: 0')).toBeTruthy());
    expect(screen.queryByText('Marks entry progress')).toBeNull();
    expect(screen.queryByText('Subjects by class')).toBeNull();
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
    await waitFor(() => expect(screen.getByLabelText('Classes: 2')).toBeTruthy());
    expect(screen.queryByText(new RegExp(todayIso()))).toBeNull();
  });

  describe('summaries open their pages', () => {
    it('opens Attendance from the Classes tile, My classes from Subjects, and Marks entry from Open exams', async () => {
      seed();
      await render(<HomeScreen />, { wrapper });
      const user = userEvent.setup();

      await user.press(await screen.findByRole('button', { name: 'Classes: 2' }));
      expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/teacher/attendance', params: { subtab: 'students' } });

      await user.press(screen.getByRole('button', { name: 'Subjects: 1' }));
      expect(mockPush).toHaveBeenLastCalledWith('/teacher/academic/assignments');

      await user.press(await screen.findByRole('button', { name: 'Open exams: 1' }));
      expect(mockPush).toHaveBeenLastCalledWith('/teacher/academic/marks');
    });

    it('opens the same pages from the charts', async () => {
      seed();
      await render(<HomeScreen />, { wrapper });
      const user = userEvent.setup();

      await user.press(await screen.findByRole('button', { name: /^Marks entry progress/ }));
      expect(mockPush).toHaveBeenLastCalledWith('/teacher/academic/marks');

      await user.press(screen.getByRole('button', { name: /^Subjects by class/ }));
      expect(mockPush).toHaveBeenLastCalledWith('/teacher/academic/assignments');
    });

    it('sends the Classes tile to My classes when the teacher cannot mark attendance', async () => {
      seed({ permissions: ['exam_result.save'] });
      await render(<HomeScreen />, { wrapper });

      await userEvent.setup().press(await screen.findByRole('button', { name: 'Classes: 2' }));
      expect(mockPush).toHaveBeenLastCalledWith('/teacher/academic/assignments');
    });

    it('keeps a tile plain when its page is not available to this school', async () => {
      seed({ mobileModules: [{ moduleKey: 'my_classes', visible: false }] });
      await render(<HomeScreen />, { wrapper });

      await waitFor(() => expect(screen.getByLabelText('Subjects: 1')).toBeTruthy());
      expect(screen.queryByRole('button', { name: 'Subjects: 1' })).toBeNull();
      expect(screen.queryByRole('button', { name: /^Subjects by class/ })).toBeNull();
      // Attendance is its own area, so the Classes tile still opens it.
      expect(screen.getByRole('button', { name: 'Classes: 2' })).toBeTruthy();
    });
  });

  describe('Academic calendar', () => {
    const withCalendar = () => seed({ permissions: ['attendance.mark', 'attendance.self', 'exam_result.save', 'calendar.read'] });

    it('sits just below the tiles, with the events and notices just below it and the other summaries after', async () => {
      withCalendar();
      await render(<HomeScreen />, { wrapper });

      expect(await screen.findByText('Fee notice')).toBeTruthy();
      expect(await screen.findByText('Upcoming events')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Next month' })).toBeTruthy(); // the month's stepper
      expect(screen.getByText('On 2026-10-23')).toBeTruthy();
      expect(await screen.findByText('My Attendance This Month')).toBeTruthy();

      // The rendered text in screen order, so the test reads the layout and not the markup.
      const texts = (node: unknown): string[] =>
        typeof node === 'string' ? [node] : ((node as { children?: unknown[] | null } | null)?.children ?? []).flatMap(texts);
      const rendered = texts({ children: [screen.toJSON()].flat() });
      const at = (text: string) => rendered.indexOf(text);
      expect(at('Open exams')).toBeGreaterThan(-1);
      expect(at('Open exams')).toBeLessThan(at('Academic Calendar'));
      expect(at('Academic Calendar')).toBeLessThan(at('Upcoming events'));
      expect(at('Upcoming events')).toBeLessThan(at('School notices'));
      expect(at('School notices')).toBeLessThan(at('My Attendance This Month'));
      expect(at('My Attendance This Month')).toBeLessThan(at('Marks entry progress'));
    });

    it('reads the same three things as the Calendar screen: this month, the next 60 days and the notices', async () => {
      withCalendar();
      await render(<HomeScreen />, { wrapper });

      await screen.findByText('Fee notice');
      expect(getCalendar).toHaveBeenCalledTimes(2);
      expect(getCalendar).toHaveBeenCalledWith('2026-10-01', '2026-10-31');
      expect(getCalendar).toHaveBeenCalledWith('2026-10-23', '2026-12-22');
      expect(getNotices).toHaveBeenCalledTimes(1);
      expect(getNotices).toHaveBeenCalledWith(5);
    });

    it('lists the upcoming events and opens the full Calendar from its link', async () => {
      withCalendar();
      await render(<HomeScreen />, { wrapper });

      await waitFor(() => expect(screen.getAllByText('Parents meeting').length).toBeGreaterThan(0));
      await userEvent.setup().press(screen.getByRole('button', { name: 'Open calendar' }));
      expect(mockPush).toHaveBeenLastCalledWith('/teacher/more/calendar');
    });

    it('shows the items of a tapped day in place', async () => {
      withCalendar();
      await render(<HomeScreen />, { wrapper });

      await userEvent.setup().press(await screen.findByRole('button', { name: /^2026-10-28, Items: 1/ }));
      expect(screen.getByText('On 2026-10-28')).toBeTruthy();
    });

    it('is not requested, or shown, without calendar.read', async () => {
      seed();
      await render(<HomeScreen />, { wrapper });

      await waitFor(() => expect(screen.getByLabelText('Classes: 2')).toBeTruthy());
      expect(screen.queryByText('Academic Calendar')).toBeNull();
      expect(getCalendar).not.toHaveBeenCalled();
      expect(getNotices).not.toHaveBeenCalled();
    });

    it('hides the whole block, and keeps the rest of the Dashboard, when the calendar answers 403', async () => {
      withCalendar();
      jest.mocked(getCalendar).mockRejectedValue(new ApiError(403, 'You do not have permission (calendar.read)'));
      await render(<HomeScreen />, { wrapper });

      await waitFor(() => expect(getCalendar).toHaveBeenCalled());
      await waitFor(() => expect(screen.queryByText('Academic Calendar')).toBeNull());
      expect(screen.queryByText('Upcoming events')).toBeNull();
      expect(screen.queryByText('School notices')).toBeNull();
      expect(screen.getByLabelText('Classes: 2')).toBeTruthy();
    });

    it('offers a retry inside the block when the month cannot be loaded, and keeps the rest', async () => {
      withCalendar();
      jest.mocked(getCalendar).mockRejectedValue(new ApiError(500, 'boom'));
      await render(<HomeScreen />, { wrapper });

      expect(await screen.findByText('Academic Calendar')).toBeTruthy();
      expect(await screen.findByText('Could not load this section.')).toBeTruthy();
      expect(screen.getByLabelText('Classes: 2')).toBeTruthy();
      expect(screen.queryByText('Upcoming events')).toBeNull();
    });

    it('hides only the notices when only they are refused', async () => {
      withCalendar();
      jest.mocked(getNotices).mockRejectedValue(new ApiError(403, 'No access'));
      await render(<HomeScreen />, { wrapper });

      expect(await screen.findByText('Upcoming events')).toBeTruthy();
      await waitFor(() => expect(getNotices).toHaveBeenCalled());
      expect(screen.getByRole('button', { name: 'Next month' })).toBeTruthy();
      expect(screen.queryByText('School notices')).toBeNull();
    });

    it('re-reads the calendar on a pull', async () => {
      withCalendar();
      await render(<HomeScreen />, { wrapper });
      await screen.findByText('Fee notice');
      expect(getNotices).toHaveBeenCalledTimes(1);

      const scrollView = screen.root!.queryAll((node) => node.type === 'RCTScrollView')[0]!;
      await userEvent.setup().pullToRefresh(scrollView);

      await waitFor(() => expect(getNotices).toHaveBeenCalledTimes(2));
      expect(getCalendar).toHaveBeenCalledTimes(4);
    });
  });

  it('shows zero counts and no charts or banner when there is nothing to show', async () => {
    seed();
    jest.mocked(getTeacherMyClasses).mockResolvedValue({ restricted: true, classes: [], subjects: [] });
    jest.mocked(getTeacherExams).mockResolvedValue([]);
    await render(<HomeScreen />, { wrapper });

    await waitFor(() => expect(screen.getByLabelText('Classes: 0')).toBeTruthy());
    expect(screen.getByLabelText('Subjects: 0')).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText('Open exams: 0')).toBeTruthy());
    expect(screen.queryByText('Marks entry progress')).toBeNull();
    expect(screen.queryByText('Subjects by class')).toBeNull();
    expect(screen.queryByText(/Returned for correction/)).toBeNull();
  });

  it('drops the exams tile and chart when exams answers 403 (no staff link), and keeps the rest', async () => {
    seed();
    jest.mocked(getTeacherExams).mockRejectedValue(new ApiError(403, 'No access'));
    await render(<HomeScreen />, { wrapper });

    await waitFor(() => expect(screen.getByLabelText('Classes: 2')).toBeTruthy());
    await waitFor(() => expect(getTeacherExams).toHaveBeenCalled());
    expect(screen.queryByLabelText(/^Open exams/)).toBeNull();
    expect(screen.queryByText('Marks entry progress')).toBeNull();
    expect(screen.queryByText("You don't have access to this section.")).toBeNull();
    expect(getTeacherExams).toHaveBeenCalledTimes(1);
  });

  it('does not even request exams when the school turned the exams module off for mobile', async () => {
    seed({ mobileModules: [{ moduleKey: 'exams', visible: false }] });
    await render(<HomeScreen />, { wrapper });

    await waitFor(() => expect(screen.getByLabelText('Classes: 2')).toBeTruthy());
    expect(screen.queryByLabelText(/^Open exams/)).toBeNull();
    expect(screen.queryByText('Marks entry progress')).toBeNull();
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
    expect(screen.getByLabelText('Classes: 2')).toBeTruthy();
    expect(screen.getByText('Marks entry progress')).toBeTruthy();
    expect(screen.queryByText(/Could not reach the server/)).toBeNull();
    expect(screen.queryByText(/^Updated/)).toBeNull();
  });

  it('shows an error with retry when there is nothing cached', async () => {
    seed();
    jest.mocked(getTeacherMyClasses).mockRejectedValue(new ApiError(500, 'boom'));
    await render(<HomeScreen />, { wrapper });

    await waitFor(() => expect(screen.getAllByText('Could not load this section.')).toHaveLength(1));
    expect(screen.getAllByRole('button', { name: 'Try again' })).toHaveLength(1);
  });

  it('says there is no access when my-classes answers 403, once', async () => {
    seed();
    jest.mocked(getTeacherMyClasses).mockRejectedValue(new ApiError(403, 'No access'));
    await render(<HomeScreen />, { wrapper });

    await waitFor(() => expect(screen.getByText("You don't have access to this section.")).toBeTruthy());
    expect(screen.getAllByText("You don't have access to this section.")).toHaveLength(1);
    expect(screen.queryByLabelText(/^Classes:/)).toBeNull();
  });

  it('refreshes my-schools once and hides the tiles when the license no longer covers them', async () => {
    seed();
    jest
      .mocked(getTeacherMyClasses)
      .mockRejectedValue(new ApiError(403, 'Not licensed', 'ENTITLEMENT_DENIED'));
    await render(<HomeScreen />, { wrapper });

    await waitFor(() => expect(getMySchools).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByLabelText(/^Classes:/)).toBeNull());
    expect(screen.queryByText("You don't have access to this section.")).toBeNull();
  });

  it('pull-to-refresh re-requests both lists and shows when it was last updated', async () => {
    seed();
    await render(<HomeScreen />, { wrapper });
    await waitFor(() => expect(screen.getByLabelText('Open exams: 1')).toBeTruthy());
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
