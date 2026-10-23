import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { getExamResults, getExamRoster } from '../../../../api/academic';
import { removeTenantQueries, USER_SCOPE } from '../../../../api/queryKeys';
import type { ExamResult, ExamRosterRow } from '../../../../api/types/academic';
import { resetSessionForTests, selectTenant } from '../../../../auth/session';
import { teacherExamsKey } from '../../queries';
import { examResultsKey, examRosterKey, useExamResults, useExamRoster } from '../queries';

jest.mock('../../../../api/academic');

const ROSTER: ExamRosterRow[] = [{ enrollmentId: 'e1', fullName: 'Anil Rai', admissionNumber: 'A1', rollNumber: '1' }];
const RESULTS: ExamResult[] = [{ id: 'r1', enrollmentId: 'e1', version: 2, components: [] }];
const QUERY = { examId: 'x1', sectionId: 's8' };

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeEach(() => {
  resetSessionForTests();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  jest.mocked(getExamRoster).mockResolvedValue(ROSTER);
  jest.mocked(getExamResults).mockResolvedValue(RESULTS);
});

afterEach(() => {
  client.clear();
  jest.clearAllMocks();
});

describe('marks query keys', () => {
  it('start with the school, then the exam (and section), so a school switch cannot show another school', () => {
    expect(examRosterKey('t1', QUERY)).toEqual(['t1', 'teacher', 'marks', 'roster', 'x1', 's8']);
    expect(examRosterKey('t1', { examId: 'x1', sectionId: null })).toEqual(['t1', 'teacher', 'marks', 'roster', 'x1', 'none']);
    expect(examResultsKey('t1', 'x1')).toEqual(['t1', 'teacher', 'marks', 'results', 'x1']);
  });

  it('use the user scope, never a school, before a school is selected', () => {
    expect(examRosterKey(null, QUERY)[0]).toBe(USER_SCOPE);
    expect(examResultsKey(null, 'x1')[0]).toBe(USER_SCOPE);
  });

  it('differ per exam and per section', () => {
    expect(examRosterKey('t1', QUERY)).not.toEqual(examRosterKey('t1', { ...QUERY, sectionId: 's9' }));
    expect(examResultsKey('t1', 'x1')).not.toEqual(examResultsKey('t1', 'x2'));
  });

  it('are removed with the rest of a school on a school switch or sign-out, and only that school', () => {
    client.setQueryData(examRosterKey('t1', QUERY), ROSTER);
    client.setQueryData(examResultsKey('t1', 'x1'), RESULTS);
    client.setQueryData(teacherExamsKey('t1'), []);
    client.setQueryData(examResultsKey('t2', 'x1'), RESULTS);

    removeTenantQueries(client, 't1');

    expect(client.getQueryData(examRosterKey('t1', QUERY))).toBeUndefined();
    expect(client.getQueryData(examResultsKey('t1', 'x1'))).toBeUndefined();
    expect(client.getQueryData(teacherExamsKey('t1'))).toBeUndefined();
    expect(client.getQueryData(examResultsKey('t2', 'x1'))).toBeDefined();
  });
});

describe('useExamRoster and useExamResults', () => {
  it('request the roster for the selected subject and the results for the exam', async () => {
    selectTenant('t1');
    const roster = await renderHook(() => useExamRoster(QUERY), { wrapper });
    const results = await renderHook(() => useExamResults('x1'), { wrapper });

    await waitFor(() => expect(roster.result.current.data).toEqual(ROSTER));
    await waitFor(() => expect(results.result.current.data).toEqual(RESULTS));
    expect(getExamRoster).toHaveBeenCalledWith(QUERY);
    expect(getExamResults).toHaveBeenCalledWith('x1');
  });

  it('keep schools apart: the same exam id in another school is a separate request', async () => {
    selectTenant('t1');
    const { result } = await renderHook(() => useExamResults('x1'), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(RESULTS));

    jest.mocked(getExamResults).mockResolvedValue([{ id: 'r9', enrollmentId: 'e9', version: 1, components: [] }]);
    await act(async () => {
      selectTenant('t2');
    });
    await waitFor(() => expect(result.current.data?.[0]?.id).toBe('r9'));

    expect(getExamResults).toHaveBeenCalledTimes(2);
    expect(client.getQueryData<ExamResult[]>(examResultsKey('t1', 'x1'))?.[0]?.id).toBe('r1');
  });

  it('stay off with no subject, and with no school', async () => {
    selectTenant('t1');
    await renderHook(() => useExamRoster(null), { wrapper });
    await renderHook(() => useExamResults(null), { wrapper });
    expect(getExamRoster).not.toHaveBeenCalled();
    expect(getExamResults).not.toHaveBeenCalled();

    await act(async () => {
      resetSessionForTests();
    });
    await renderHook(() => useExamRoster(QUERY), { wrapper });
    await renderHook(() => useExamResults('x1'), { wrapper });
    expect(getExamRoster).not.toHaveBeenCalled();
    expect(getExamResults).not.toHaveBeenCalled();
  });

  it('do not refetch inside the Daily window', async () => {
    selectTenant('t1');
    client.setQueryData(examRosterKey('t1', QUERY), ROSTER);
    client.setQueryData(examResultsKey('t1', 'x1'), RESULTS);
    const roster = await renderHook(() => useExamRoster(QUERY), { wrapper });
    const results = await renderHook(() => useExamResults('x1'), { wrapper });

    expect(roster.result.current.data).toBe(ROSTER);
    expect(results.result.current.data).toBe(RESULTS);
    expect(getExamRoster).not.toHaveBeenCalled();
    expect(getExamResults).not.toHaveBeenCalled();
  });
});
