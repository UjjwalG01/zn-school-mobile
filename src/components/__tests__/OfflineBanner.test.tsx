import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ApiError, NETWORK_ERROR_CODE } from '../../api/errors';
import { getTenantSettings } from '../../api/settings';
import { resetSessionForTests, selectTenant } from '../../auth/session';
import { tenantSettingsKey } from '../../features/queries';
import { formatTimestamp } from '../../lib/date';
import { OfflineBanner, savedDataTimestamp } from '../OfflineBanner';

jest.mock('../../api/settings');

const offline = new ApiError(0, 'x', NETWORK_ERROR_CODE);

describe('savedDataTimestamp', () => {
  it('is the time of cached data that could not be refreshed because the device is offline', () => {
    expect(savedDataTimestamp([{ data: [], error: offline, dataUpdatedAt: 1000 }])).toBe(1000);
  });

  it('uses the oldest of several, and ignores queries that are fine or have nothing cached', () => {
    expect(
      savedDataTimestamp([
        { data: [], error: offline, dataUpdatedAt: 3000 },
        { data: [], error: offline, dataUpdatedAt: 2000 },
        { data: [], error: null, dataUpdatedAt: 1 },
        { data: undefined, error: offline, dataUpdatedAt: 0 },
      ]),
    ).toBe(2000);
  });

  it('is null when no refresh failed offline (other errors keep their own message)', () => {
    expect(savedDataTimestamp([])).toBeNull();
    expect(savedDataTimestamp([{ data: [], error: null, dataUpdatedAt: 1000 }])).toBeNull();
    expect(
      savedDataTimestamp([{ data: [], error: new ApiError(500, 'x'), dataUpdatedAt: 1000 }]),
    ).toBeNull();
  });
});

describe('OfflineBanner', () => {
  const STAMP = new Date(2026, 9, 21, 9, 42).getTime();
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    resetSessionForTests();
    selectTenant('t1');
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    jest.mocked(getTenantSettings).mockResolvedValue({ calendarPreference: 'gregorian' });
  });

  afterEach(() => {
    client.clear();
    jest.clearAllMocks();
  });

  it('says the data is saved and from when, in the tenant calendar', async () => {
    client.setQueryData(tenantSettingsKey('t1'), { calendarPreference: 'gregorian' });
    await render(<OfflineBanner asOf={STAMP} />, { wrapper });

    expect(screen.getByText(`Showing saved data from ${formatTimestamp(STAMP, 'gregorian')}`)).toBeTruthy();
  });

  it('renders nothing, and makes no request, when the screen is not offline', async () => {
    await render(<OfflineBanner asOf={null} />, { wrapper });

    expect(screen.queryByText(/saved data/)).toBeNull();
    expect(getTenantSettings).not.toHaveBeenCalled();
  });

  it('waits for the calendar setting instead of assuming one', async () => {
    jest.mocked(getTenantSettings).mockReturnValue(new Promise(() => undefined));
    await render(<OfflineBanner asOf={STAMP} />, { wrapper });

    await waitFor(() => expect(getTenantSettings).toHaveBeenCalled());
    expect(screen.queryByText(/saved data/)).toBeNull();
  });
});
