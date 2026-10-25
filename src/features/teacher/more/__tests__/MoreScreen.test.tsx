import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { getMobileModules } from '../../../../api/settings';
import { getMyPermissions, getMySchools } from '../../../../api/tenancy';
import type { School } from '../../../../api/types/tenancy';
import { myPermissionsKey, mySchoolsKey } from '../../../../auth/queries';
import { resetSessionForTests, selectTenant } from '../../../../auth/session';
import { mobileModulesKey } from '../../../queries';
import MoreScreen from '../MoreScreen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../../../../api/settings');
jest.mock('../../../../api/tenancy');

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

function seed(keys: string[], all = false) {
  client.setQueryData(mySchoolsKey(), [SCHOOL]);
  client.setQueryData(myPermissionsKey('t1'), { all, keys });
  client.setQueryData(mobileModulesKey('t1'), []);
}

beforeEach(() => {
  resetSessionForTests();
  selectTenant('t1');
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  jest.mocked(getMySchools).mockResolvedValue([SCHOOL]);
  jest.mocked(getMyPermissions).mockResolvedValue({ all: false, keys: [] });
  jest.mocked(getMobileModules).mockResolvedValue([]);
});

afterEach(() => {
  client.clear();
  jest.clearAllMocks();
});

describe('More hub', () => {
  it('shows the Academic Calendar as a card for a teacher who can read the calendar, and opens it', async () => {
    seed(['calendar.read']);
    await render(<MoreScreen />, { wrapper });
    const user = userEvent.setup();

    await user.press(await screen.findByRole('button', { name: 'Academic Calendar' }));
    expect(mockPush).toHaveBeenCalledWith('/teacher/more/calendar');
    expect(screen.queryByText('More features for teachers are coming soon.')).toBeNull();
  });

  it('always offers Notifications (the inbox needs no permission), and opens it', async () => {
    seed(['attendance.mark']);
    await render(<MoreScreen />, { wrapper });
    const user = userEvent.setup();

    await user.press(await screen.findByRole('button', { name: 'Notifications' }));
    expect(mockPush).toHaveBeenCalledWith('/teacher/more/notifications');
    // Without calendar.read the calendar card is not offered, and the hub is no longer empty.
    expect(screen.queryByRole('button', { name: 'Academic Calendar' })).toBeNull();
    expect(screen.queryByText('More features for teachers are coming soon.')).toBeNull();
  });

  it('lists nothing from another hub', async () => {
    seed([], true);
    await render(<MoreScreen />, { wrapper });

    expect(await screen.findByRole('button', { name: 'Academic Calendar' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Exam attendance' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Marks entry' })).toBeNull();
  });
});
