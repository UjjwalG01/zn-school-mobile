import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { getMobileModules } from '../src/api/settings';
import { getMyPermissions, getMySchools } from '../src/api/tenancy';
import type { MobileModuleToggle } from '../src/api/types/settings';
import type { School } from '../src/api/types/tenancy';
import { myPermissionsKey, mySchoolsKey } from '../src/auth/queries';
import { resetSessionForTests, selectTenant, setShells, startSession } from '../src/auth/session';
import { mobileModulesKey } from '../src/features/queries';
import TeacherLayout from '../app/teacher/_layout';

const mockScreens: { name: string; options: Record<string, unknown> }[] = [];
const mockRedirect = jest.fn();
const mockMounts = { tabs: 0 };
jest.mock('expo-router', () => {
  const { View } = jest.requireActual('react-native');
  const { createElement, useEffect } = jest.requireActual('react');
  const Tabs = ({ children }: { children: ReactNode }) => {
    // Counts how often the navigator is created, to prove a school switch remounts it.
    useEffect(() => {
      mockMounts.tabs += 1;
    }, []);
    return createElement(View, null, children);
  };
  Tabs.Screen = function MockTabsScreen({
    name,
    options,
  }: {
    name: string;
    options: Record<string, unknown>;
  }) {
    mockScreens.push({ name, options });
    return null;
  };
  return {
    Tabs,
    Redirect: ({ href }: { href: string }) => {
      mockRedirect(href);
      return null;
    },
    useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  };
});
jest.mock('../src/api/settings');
jest.mock('../src/api/tenancy');

const SCHOOL: School = {
  tenantId: 't1',
  name: 'Everest School',
  status: 'active',
  license: { status: 'active', tierName: null, validUntil: null, expiringSoon: false, modules: ['academic'] },
};

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

/** TanStack announces "fetch started" on a 0 ms timer; let it land inside act before asserting. */
async function renderLayout() {
  const view = await render(<TeacherLayout />, { wrapper });
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
  return view;
}

function openTeacherShell({
  withContext = true,
  mobileModules = [],
  licenseModules = SCHOOL.license.modules,
  permissions = ['attendance.mark'],
}: {
  withContext?: boolean;
  mobileModules?: MobileModuleToggle[];
  licenseModules?: string[];
  permissions?: string[];
} = {}) {
  startSession();
  selectTenant('t1');
  setShells(['teacher'], 'teacher');
  client.setQueryData(mobileModulesKey('t1'), mobileModules);
  if (withContext) {
    client.setQueryData(mySchoolsKey(), [{ ...SCHOOL, license: { ...SCHOOL.license, modules: licenseModules } }]);
    client.setQueryData(myPermissionsKey('t1'), { all: false, keys: permissions });
  }
}

/** The tab names that got a real tab (not `href: null`), in bar order. */
const shownTabs = () => mockScreens.filter((s) => s.options.href !== null).map((s) => s.name);
const hiddenTabs = () => mockScreens.filter((s) => s.options.href === null).map((s) => s.name);

beforeEach(() => {
  resetSessionForTests();
  mockScreens.length = 0;
  mockMounts.tabs = 0;
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  jest.mocked(getMobileModules).mockResolvedValue([]);
  // Unseeded context queries stay pending, as on a slow network; nothing may reach the real API.
  jest.mocked(getMySchools).mockReturnValue(new Promise(() => undefined));
  jest.mocked(getMyPermissions).mockReturnValue(new Promise(() => undefined));
});

afterEach(() => {
  client.clear();
  jest.clearAllMocks();
});

describe('teacher tab layout', () => {
  it('builds the five tabs from the registry, with a title and an icon each', async () => {
    openTeacherShell();
    await renderLayout();

    expect(mockScreens.map((s) => s.name)).toEqual(['index', 'attendance', 'academic', 'more', 'profile']);
    expect(mockScreens.map((s) => s.options.title)).toEqual([
      'Dashboard',
      'Attendance',
      'Academic',
      'More',
      'Profile',
    ]);
    for (const screen of mockScreens) expect(screen.options.tabBarIcon).toEqual(expect.any(Function));
    // Attendance, Academic and More are nested stacks (a hub of cards, then its screens) that draw their own header.
    expect(mockScreens.filter((s) => s.options.headerShown === false).map((s) => s.name)).toEqual([
      'attendance',
      'academic',
      'more',
    ]);
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('draws the active tab with the filled glyph and the others as outlines', async () => {
    openTeacherShell();
    await renderLayout();

    type TabIcon = (state: { color: string; size: number; focused: boolean }) => { props: { name: string } };
    const iconOf = (tab: string, focused: boolean) => {
      const options = mockScreens.find((s) => s.name === tab)?.options;
      return (options?.tabBarIcon as TabIcon)({ color: '#000', size: 24, focused }).props.name;
    };
    expect(iconOf('index', false)).toBe('home-outline');
    expect(iconOf('index', true)).toBe('home');
    expect(iconOf('profile', true)).toBe('person-circle');
    expect(iconOf('more', true)).toBe('ellipsis-horizontal-circle');
  });

  it('keeps the route but drops the Attendance tab when the school turned that module off', async () => {
    openTeacherShell({ mobileModules: [{ moduleKey: 'attendance', visible: false }] });
    await renderLayout();

    expect(shownTabs()).toEqual(['index', 'academic', 'more', 'profile']);
    expect(hiddenTabs()).toEqual(['attendance']);
  });

  it('shows Attendance to a teacher who may only mark their own attendance', async () => {
    openTeacherShell({ permissions: ['attendance.self'] });
    await renderLayout();

    expect(shownTabs()).toContain('attendance');
  });

  it('drops Attendance without attendance.mark or attendance.self', async () => {
    openTeacherShell({ permissions: [] });
    await renderLayout();

    expect(hiddenTabs()).toEqual(['attendance']);
  });

  it('drops Attendance and Academic when the license has no academic module', async () => {
    openTeacherShell({ licenseModules: ['fees'] });
    await renderLayout();

    expect(shownTabs()).toEqual(['index', 'more', 'profile']);
    expect(hiddenTabs()).toEqual(['attendance', 'academic']);
  });

  it('never hides More or Profile, even when the school turned every mobile module off', async () => {
    openTeacherShell({
      mobileModules: [
        { moduleKey: 'my_dashboard', visible: false },
        { moduleKey: 'my_classes', visible: false },
        { moduleKey: 'attendance', visible: false },
        { moduleKey: 'exams', visible: false },
      ],
      permissions: [],
    });
    await renderLayout();

    expect(shownTabs()).toEqual(['academic', 'more', 'profile']);
    expect(hiddenTabs()).toEqual(['index', 'attendance']);
  });

  it('drops the tabs when the selected school changes, then rebuilds them for the new school', async () => {
    openTeacherShell();
    await renderLayout();
    expect(mockMounts.tabs).toBe(1);
    expect(shownTabs()).toContain('attendance');

    // The second school's license has no academic module, so Attendance and Academic must go.
    client.setQueryData(mobileModulesKey('t2'), []);
    client.setQueryData(myPermissionsKey('t2'), { all: false, keys: ['attendance.mark'] });
    client.setQueryData(mySchoolsKey(), [
      SCHOOL,
      { ...SCHOOL, tenantId: 't2', name: 'Other School', license: { ...SCHOOL.license, modules: ['fees'] } },
    ]);
    mockScreens.length = 0;
    await act(async () => {
      selectTenant('t2'); // a switch clears the shell, so the guard sends the user through /resolve
    });
    expect(mockRedirect).toHaveBeenCalledWith('/resolve');
    expect(mockScreens).toEqual([]);

    await act(async () => {
      setShells(['teacher'], 'teacher'); // /resolve has recomputed the shell for the new school
    });
    expect(mockMounts.tabs).toBe(2); // a new navigator, not the old school's nested screens
    expect(shownTabs()).toEqual(['index', 'more', 'profile']);
  });

  it('sends the user back to /resolve while permissions or schools are not loaded', async () => {
    openTeacherShell({ withContext: false });
    await renderLayout();

    expect(mockRedirect).toHaveBeenCalledWith('/resolve');
    expect(mockScreens).toEqual([]);
  });

  it('redirects to /resolve when the active shell is not the teacher shell', async () => {
    startSession();
    selectTenant('t1');
    setShells(['teacher', 'guardian'], 'guardian');
    await renderLayout();

    expect(mockRedirect).toHaveBeenCalledWith('/resolve');
    expect(mockScreens).toEqual([]);
  });
});
