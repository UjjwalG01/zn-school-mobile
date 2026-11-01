import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Alert } from 'react-native';

import type { Me } from '../../../api/types/identity';
import type { School } from '../../../api/types/tenancy';
import { meKey, mySchoolsKey } from '../../../auth/queries';
import { resetSessionForTests, selectTenant, setShells } from '../../../auth/session';
import ProfileScreen from '../ProfileScreen';

const mockSignOut = jest.fn();
const mockOpenPicker = jest.fn();
let mockCanSwitch = false;
jest.mock('../../../auth/useSignOut', () => ({ useSignOut: () => mockSignOut }));
jest.mock('../../../auth/useSchoolSwitch', () => ({
  useSchoolSwitch: () => ({ canSwitch: mockCanSwitch, openPicker: mockOpenPicker }),
}));
jest.mock('../../../api/identity');
jest.mock('../../../api/tenancy');

const ME: Me = {
  id: 'u1',
  email: 'sita@school.test',
  phone: '+9779800000000',
  fullName: 'Sita Sharma',
  isPlatformAdmin: false,
  sessionTimeoutMinutes: 30,
};

const SCHOOL: School = {
  tenantId: 't1',
  name: 'Everest School',
  status: 'active',
  license: { status: 'active', tierName: null, validUntil: '2027-04-13', expiringSoon: true, modules: ['academic'] },
};

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

function seed(me: Me = ME) {
  client.setQueryData(meKey(), me);
  client.setQueryData(mySchoolsKey(), [SCHOOL]);
}

beforeEach(() => {
  mockCanSwitch = false;
  resetSessionForTests();
  selectTenant('t1');
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
});

afterEach(() => {
  client.clear();
  jest.clearAllMocks();
});

describe('Profile', () => {
  it('shows who is signed in and the school, with no repeated title and no license dates', async () => {
    seed();
    await render(<ProfileScreen />, { wrapper });

    expect(screen.getByText('Sita Sharma')).toBeTruthy();
    expect(screen.getByText('sita@school.test')).toBeTruthy();
    expect(screen.getByText('+9779800000000')).toBeTruthy();
    expect(screen.getByText('Everest School')).toBeTruthy();
    expect(screen.queryByText('Profile')).toBeNull(); // the tab header says it
    // The license is the administrator's business: a teacher cannot act on it, even when it is about to end.
    expect(screen.queryByText(/License|Contact your school/)).toBeNull();
  });

  it('shows only the contact the account has (a phone-only account has no email row)', async () => {
    seed({ ...ME, email: null });
    await render(<ProfileScreen />, { wrapper });

    expect(screen.queryByText('Email')).toBeNull();
    expect(screen.getByText('+9779800000000')).toBeTruthy();
  });

  it('offers Switch school only with more than one school, and opens the picker', async () => {
    seed();
    const view = await render(<ProfileScreen />, { wrapper });
    expect(screen.queryByRole('button', { name: 'Switch school' })).toBeNull();
    await view.unmount();

    mockCanSwitch = true;
    await render(<ProfileScreen />, { wrapper });
    await userEvent.setup().press(screen.getByRole('button', { name: 'Switch school' }));
    expect(mockOpenPicker).toHaveBeenCalledTimes(1);
  });

  it('asks before signing out, and signs out through the session machinery only on confirm', async () => {
    seed();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await render(<ProfileScreen />, { wrapper });

    await userEvent.setup().press(screen.getByRole('button', { name: 'Sign out' }));
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledTimes(1);
    const buttons = alert.mock.calls[0]?.[2] ?? [];
    expect(buttons.map((button) => button.text)).toEqual(['Cancel', 'Sign out']);

    buttons[0]?.onPress?.(); // Cancel has no handler: nothing happens
    expect(mockSignOut).not.toHaveBeenCalled();
    buttons[1]?.onPress?.();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });

  it('offers the other shell to someone who holds both', async () => {
    seed();
    setShells(['teacher', 'guardian'], 'teacher');
    await render(<ProfileScreen />, { wrapper });

    expect(screen.getByRole('button', { name: 'Switch to Guardian' })).toBeTruthy();
  });
});
