import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { getTeacherExams, getTeacherMyClasses } from '../../api/portal';
import { getMobileModules, getTenantSettings } from '../../api/settings';
import { USER_SCOPE } from '../../api/queryKeys';
import type { TeacherMyClasses } from '../../api/types/portal';
import { resetSessionForTests, selectTenant } from '../../auth/session';
import {
  mobileModulesKey,
  tenantSettingsKey,
  useMobileModules,
  useTenantSettings,
} from '../queries';
import {
  teacherExamsKey,
  teacherMyClassesKey,
  useTeacherExams,
  useTeacherMyClasses,
} from '../teacher/queries';

jest.mock('../../api/portal');
jest.mock('../../api/settings');

const myClasses = (className: string) => ({
  restricted: true,
  classes: [{ classId: 'c1', className, sectionId: 's1', sectionName: 'A' }],
  subjects: [],
});

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeEach(() => {
  resetSessionForTests();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  jest.mocked(getTeacherMyClasses).mockImplementation(async () => myClasses('Class 8'));
  jest.mocked(getTeacherExams).mockResolvedValue([]);
  jest.mocked(getTenantSettings).mockResolvedValue({ calendarPreference: 'gregorian' });
  jest.mocked(getMobileModules).mockResolvedValue([]);
});

afterEach(() => {
  client.clear(); // release gc timers so Jest can exit
  jest.clearAllMocks();
});

describe('query keys', () => {
  it('start with the tenantId; without a school they use the user scope', () => {
    expect(teacherMyClassesKey('t1', '2026-10-21')).toEqual(['t1', 'teacher', 'my-classes', '2026-10-21']);
    expect(teacherExamsKey('t1')).toEqual(['t1', 'teacher', 'exams']);
    expect(tenantSettingsKey('t1')).toEqual(['t1', 'tenant-settings']);
    expect(mobileModulesKey('t1')).toEqual(['t1', 'mobile-modules']);
    for (const key of [
      teacherMyClassesKey(null, '2026-10-21'),
      teacherExamsKey(null),
      tenantSettingsKey(null),
      mobileModulesKey(null),
    ]) {
      expect(key[0]).toBe(USER_SCOPE);
    }
  });
});

describe('without a selected school', () => {
  it('sends no request', async () => {
    await renderHook(
      () => {
        useTeacherMyClasses('2026-10-21');
        useTeacherExams();
        useTenantSettings();
        useMobileModules();
      },
      { wrapper },
    );
    expect(getTeacherMyClasses).not.toHaveBeenCalled();
    expect(getTeacherExams).not.toHaveBeenCalled();
    expect(getTenantSettings).not.toHaveBeenCalled();
    expect(getMobileModules).not.toHaveBeenCalled();
  });
});

describe('with a selected school', () => {
  beforeEach(() => {
    selectTenant('t1');
  });

  it('fetches my-classes for the given date and caches it under the tenant key', async () => {
    const { result } = await renderHook(() => useTeacherMyClasses('2026-10-21'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getTeacherMyClasses).toHaveBeenCalledTimes(1);
    expect(getTeacherMyClasses).toHaveBeenCalledWith('2026-10-21');
    expect(client.getQueryData(teacherMyClassesKey('t1', '2026-10-21'))).toEqual(myClasses('Class 8'));
  });

  it('skips exams while the Marks feature is not visible', async () => {
    const { result } = await renderHook(() => useTeacherExams(false), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(getTeacherExams).not.toHaveBeenCalled();
  });

  it('fetches exams, tenant settings and mobile modules once', async () => {
    const { result } = await renderHook(
      () => ({ exams: useTeacherExams(), settings: useTenantSettings(), modules: useMobileModules() }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.exams.isSuccess).toBe(true);
      expect(result.current.settings.data).toEqual({ calendarPreference: 'gregorian' });
      expect(result.current.modules.isSuccess).toBe(true);
    });
    expect(getTeacherExams).toHaveBeenCalledTimes(1);
    expect(getTenantSettings).toHaveBeenCalledTimes(1);
    expect(getMobileModules).toHaveBeenCalledTimes(1);
  });

  it('never shows one school the cached data of another after a switch', async () => {
    jest.mocked(getTeacherMyClasses).mockImplementation(async () => myClasses('Class 8'));
    const { result } = await renderHook(() => useTeacherMyClasses('2026-10-21'), { wrapper });
    await waitFor(() => expect(result.current.data?.classes[0].className).toBe('Class 8'));

    // School t2's request stays pending, so "no data yet" cannot be a timing accident.
    let release: (value: TeacherMyClasses) => void = () => undefined;
    jest.mocked(getTeacherMyClasses).mockImplementation(
      () => new Promise<TeacherMyClasses>((resolve) => (release = resolve)),
    );
    await act(async () => selectTenant('t2'));
    expect(result.current.data).toBeUndefined();

    await act(async () => release(myClasses('Class 3')));
    await waitFor(() => expect(result.current.data?.classes[0].className).toBe('Class 3'));
    expect(client.getQueryData(teacherMyClassesKey('t1', '2026-10-21'))).toEqual(myClasses('Class 8'));
    expect(client.getQueryData(teacherMyClassesKey('t2', '2026-10-21'))).toEqual(myClasses('Class 3'));
  });
});
