import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { getTeacherExams, getTeacherMyClasses } from '../../../../api/portal';
import { getTenantSettings } from '../../../../api/settings';
import { getMySchools } from '../../../../api/tenancy';
import type { TeacherExam } from '../../../../api/types/portal';
import type { MobileModuleToggle } from '../../../../api/types/settings';
import type { School } from '../../../../api/types/tenancy';
import { myPermissionsKey, mySchoolsKey } from '../../../../auth/queries';
import { resetSessionForTests, selectTenant } from '../../../../auth/session';
import { mobileModulesKey } from '../../../queries';
import AcademicHubScreen from '../AcademicHubScreen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../../../../api/portal');
jest.mock('../../../../api/settings');
jest.mock('../../../../api/tenancy');

const school = (modules: string[]): School => ({
  tenantId: 't1',
  name: 'Everest School',
  status: 'active',
  license: { status: 'active', tierName: null, validUntil: null, expiringSoon: false, modules },
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
      {
        examSubjectId: 'x1',
        subjectName: 'Mathematics',
        sectionId: 's8',
        sectionName: 'A',
        components: [],
        submission: { status: 'draft', version: 1, returnedReason: null, submittedAt: null },
      },
    ],
  },
];

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

function seed({
  permissions = ['attendance.mark', 'exam_result.save'],
  modules = ['academic'],
  mobileModules = [],
}: { permissions?: string[]; modules?: string[]; mobileModules?: MobileModuleToggle[] } = {}) {
  client.setQueryData(mySchoolsKey(), [school(modules)]);
  client.setQueryData(myPermissionsKey('t1'), { all: false, keys: permissions });
  client.setQueryData(mobileModulesKey('t1'), mobileModules);
}

beforeEach(() => {
  resetSessionForTests();
  selectTenant('t1');
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  jest.mocked(getTeacherMyClasses).mockResolvedValue({
    restricted: true,
    classes: [],
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
  });
  jest.mocked(getTeacherExams).mockResolvedValue(EXAMS);
  jest.mocked(getMySchools).mockResolvedValue([school(['academic'])]);
  jest.mocked(getTenantSettings).mockResolvedValue({ calendarPreference: 'gregorian' });
});

afterEach(() => {
  client.clear();
  jest.clearAllMocks();
});

describe('Academic hub', () => {
  it('groups My classes, My subjects, Open exams and the planned work', async () => {
    seed();
    await render(<AcademicHubScreen />, { wrapper });

    expect(await screen.findByRole('button', { name: 'My classes' })).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Mathematics — Class 8 · A')).toBeTruthy());
    expect(screen.getByText('My subjects')).toBeTruthy();
    expect(await screen.findByText('Open exams')).toBeTruthy();
    expect(await screen.findByText('Second Terminal')).toBeTruthy();
    // Marks entry is built: a card that opens it. Only the exam routine is still planned work, shown
    // as text with a badge that cannot be pressed.
    expect(screen.getByRole('button', { name: 'Marks entry' })).toBeTruthy();
    expect(screen.getByText('Exam routine')).toBeTruthy();
    expect(screen.getAllByText('Coming soon').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole('button', { name: /Exam routine/ })).toBeNull();
  });

  it('opens Marks entry from its card, inside the Academic tab', async () => {
    seed();
    await render(<AcademicHubScreen />, { wrapper });

    await userEvent.setup().press(await screen.findByRole('button', { name: 'Marks entry' }));
    expect(mockPush).toHaveBeenCalledWith('/teacher/academic/marks');
  });

  it('opens My classes from its card, inside the Academic tab', async () => {
    seed();
    await render(<AcademicHubScreen />, { wrapper });

    await userEvent.setup().press(await screen.findByRole('button', { name: 'My classes' }));
    expect(mockPush).toHaveBeenCalledWith('/teacher/academic/assignments');
  });

  it('groups Exam attendance with the other exam work, and opens it from its card', async () => {
    seed({ permissions: ['attendance.mark', 'exam_result.save', 'exam_attendance.mark'] });
    await render(<AcademicHubScreen />, { wrapper });

    const user = userEvent.setup();
    await user.press(await screen.findByRole('button', { name: 'Exam attendance' }));
    expect(mockPush).toHaveBeenCalledWith('/teacher/academic/exam-attendance');
  });

  it('shows no Exam attendance card without exam_attendance.mark, and none when the school turned exams off', async () => {
    seed({ permissions: ['attendance.mark', 'exam_result.save'] });
    const view = await render(<AcademicHubScreen />, { wrapper });
    expect(await screen.findByRole('button', { name: 'My classes' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Exam attendance' })).toBeNull();

    seed({
      permissions: ['exam_attendance.mark'],
      mobileModules: [{ moduleKey: 'exams', visible: false }],
    });
    await view.rerender(<AcademicHubScreen />);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Exam attendance' })).toBeNull());
  });

  it('shows neither Open exams nor the Marks entry row without exam_result.save, and does not ask for exams', async () => {
    seed({ permissions: ['attendance.mark'] });
    await render(<AcademicHubScreen />, { wrapper });

    await waitFor(() => expect(screen.getByText('Mathematics — Class 8 · A')).toBeTruthy());
    expect(screen.queryByText('Open exams')).toBeNull();
    expect(screen.queryByText('Marks entry')).toBeNull();
    expect(screen.getByText('Exam routine')).toBeTruthy();
    expect(getTeacherExams).not.toHaveBeenCalled();
  });

  it('drops the My classes card when the school turned it off for mobile', async () => {
    seed({ mobileModules: [{ moduleKey: 'my_classes', visible: false }] });
    await render(<AcademicHubScreen />, { wrapper });

    await waitFor(() => expect(screen.getByText('My subjects')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'My classes' })).toBeNull();
  });

  it('says nothing here is enabled when the teacher has no academic access at all', async () => {
    seed({ permissions: [], modules: ['fees'] });
    await render(<AcademicHubScreen />, { wrapper });

    expect(
      await screen.findByText('Nothing here is enabled for mobile at your school. Use the web app.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'My classes' })).toBeNull();
  });
});
