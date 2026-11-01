import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import GuardianFeesScreen from '../FeesScreen';
import { GuardianChildProvider } from '../GuardianChildContext';
import { useGuardianFees, useGuardianStudents } from '../queries';

jest.mock('../queries', () => ({ useGuardianFees: jest.fn(), useGuardianStudents: jest.fn() }));
jest.mock('../../queries', () => ({
  useTenantSettings: () => ({ data: { currencyCode: null, calendarPreference: 'gregorian' } }),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    <GuardianChildProvider>{children}</GuardianChildProvider>
  </QueryClientProvider>
);

const mockFees = useGuardianFees as jest.Mock;
const mockStudents = useGuardianStudents as jest.Mock;

const CHILDREN = [
  { studentId: 's1', fullName: 'Asha', isPrimary: true },
  { studentId: 's2', fullName: 'Bibek', isPrimary: false },
];

function fees(studentId: string, netOutstanding: string) {
  return {
    position: {
      studentId,
      receivable: netOutstanding,
      advance: '0.00',
      netOutstanding,
      totals: { invoiced: '5000.00', paid: '4000.00', refunded: '0.00', openingBalance: '0.00' },
    },
    payments: { rows: [], total: 0 },
  };
}

const FEES: Record<string, ReturnType<typeof fees>> = {
  s1: fees('s1', '1000.00'),
  s2: fees('s2', '200.00'),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockStudents.mockReturnValue({ data: CHILDREN, error: null, isRefetching: false, refetch: jest.fn() });
  mockFees.mockImplementation((studentId: string) => ({
    data: FEES[studentId],
    error: null,
    isRefetching: false,
    refetch: jest.fn(),
  }));
});

describe('guardian fees tab', () => {
  it("shows the first child's fee figures on open", async () => {
    await render(<GuardianFeesScreen />, { wrapper });
    expect(screen.getByText('1000.00')).toBeTruthy();
    expect(screen.queryByText('200.00')).toBeNull();
  });

  it("switching to the second child shows only that child's figures", async () => {
    await render(<GuardianFeesScreen />, { wrapper });
    await userEvent.press(screen.getByText('Bibek'));
    expect(screen.getByText('200.00')).toBeTruthy();
    expect(screen.queryByText('1000.00')).toBeNull();
  });

  it('the screen never asks for a family total', async () => {
    await render(<GuardianFeesScreen />, { wrapper });
    await userEvent.press(screen.getByText('Bibek'));
    const ids = mockFees.mock.calls.map(([studentId]) => studentId);
    expect(new Set(ids)).toEqual(new Set(['s1', 's2']));
    expect(screen.queryByText(/Family/)).toBeNull();
  });

  it('a child with a clear balance shows the clear label', async () => {
    mockFees.mockImplementation((studentId: string) => ({
      data: studentId === 's2' ? fees('s2', '0.00') : FEES[studentId],
      error: null,
      isRefetching: false,
      refetch: jest.fn(),
    }));
    await render(<GuardianFeesScreen />, { wrapper });
    await userEvent.press(screen.getByText('Bibek'));
    expect(screen.getByText('Nothing due')).toBeTruthy();
  });
});
