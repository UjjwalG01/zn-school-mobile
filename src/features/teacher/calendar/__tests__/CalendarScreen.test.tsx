import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ApiError, NETWORK_ERROR_CODE } from '../../../../api/errors';
import { getCalendar, getNotices } from '../../../../api/calendar';
import { getTenantSettings } from '../../../../api/settings';
import { getMySchools } from '../../../../api/tenancy';
import type { CalendarFeed, CalendarItem } from '../../../../api/types/calendar';
import { resetSessionForTests, selectTenant } from '../../../../auth/session';
import { tenantSettingsKey } from '../../../queries';
import CalendarScreen from '../CalendarScreen';
import { calendarKey } from '../queries';

jest.mock('../../../../api/calendar');
jest.mock('../../../../api/settings');
jest.mock('../../../../api/tenancy');
// A fixed "today" (Friday 23 October 2026 = Kartik 6, 2083), so the month and the upcoming window are known.
jest.mock('../../../../lib/date', () => ({ ...jest.requireActual('../../../../lib/date'), todayIso: () => '2026-10-23' }));

const event = (id: string, title: string, startDate: string, endDate = startDate, extra: Partial<CalendarItem> = {}): CalendarItem => ({
  kind: 'event',
  id,
  title,
  typeLabel: 'Trip',
  color: 'green',
  startDate,
  endDate,
  description: null,
  ...extra,
});

const FEED: CalendarItem[] = [
  { ...event('h1', 'Dashain', '2026-10-20', '2026-10-22', { kind: 'holiday', typeLabel: 'Public holiday', color: 'red' }) },
  event('e1', 'Science fair', '2026-10-23', '2026-10-23', { description: 'Bring your project' }),
  event('e2', 'Parents meeting', '2026-10-28'),
  event('e3', 'Sports week', '2026-11-04', '2026-11-06'),
  { ...event('l1', 'Sita: Casual', '2026-10-26'), kind: 'leave', typeLabel: 'Casual', color: 'purple' },
];

const within = (feed: readonly CalendarItem[], from: string, to: string) =>
  feed.filter((entry) => entry.startDate <= to && entry.endDate >= from);

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeEach(() => {
  resetSessionForTests();
  selectTenant('t1');
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  jest.mocked(getCalendar).mockImplementation(
    async (from, to): Promise<CalendarFeed> => ({ from, to, items: within(FEED, from, to), weeklyOff: [6] }),
  );
  jest.mocked(getNotices).mockResolvedValue({
    total: 2,
    rows: [
      { id: 'n1', title: 'Fee notice', body: 'Please pay before Friday.', publishedAt: '2026-10-21T08:00:00Z' },
      { id: 'n2', title: 'Holiday notice', body: 'School closed on Dashain days.', publishedAt: '2026-10-19T08:00:00Z' },
    ],
  });
  jest.mocked(getMySchools).mockResolvedValue([]);
  jest.mocked(getTenantSettings).mockResolvedValue({ calendarPreference: 'gregorian' });
});

afterEach(() => {
  client.clear();
  jest.clearAllMocks();
});

describe('Academic Calendar', () => {
  it('shows this month with the days that have something marked, today selected', async () => {
    await render(<CalendarScreen />, { wrapper });

    expect(await screen.findByText('October 2026')).toBeTruthy();
    expect(getCalendar).toHaveBeenCalledWith('2026-10-01', '2026-10-31');
    // 20-22 Oct is the holiday; the 23rd has the science fair (the selected day).
    expect(screen.getByRole('button', { name: /^2026-10-21, Holiday, Items: 1/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^2026-10-23, Items: 1/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^2026-10-27$/ })).toBeTruthy(); // nothing on it, no count
    expect(await screen.findByText('On 2026-10-23')).toBeTruthy();
    // Today's science fair is both the selected day's item and the first of the upcoming events.
    expect(screen.getAllByText('Science fair')).toHaveLength(2);
    expect(screen.getAllByText('Bring your project')).toHaveLength(2);
  });

  it('shows the items of a tapped day, and says so when there are none', async () => {
    await render(<CalendarScreen />, { wrapper });
    const user = userEvent.setup();

    await user.press(await screen.findByRole('button', { name: /^2026-10-21,/ }));
    expect(screen.getByText('On 2026-10-21')).toBeTruthy();
    expect(screen.getByText('Dashain')).toBeTruthy();
    expect(screen.getByText(/Holiday · Public holiday · 2026-10-20 to 2026-10-22/)).toBeTruthy();

    await user.press(screen.getByRole('button', { name: /^2026-10-27$/ }));
    expect(screen.getByText('Nothing is scheduled on this day.')).toBeTruthy();
    // 24 October 2026 is a Saturday, a weekly off-day of this school.
    await user.press(screen.getByRole('button', { name: /^2026-10-24, Weekly off/ }));
    expect(screen.getByText('Weekly off. Nothing is scheduled on this day.')).toBeTruthy();
  });

  it('moves between months, asking the API for each month’s own window', async () => {
    await render(<CalendarScreen />, { wrapper });
    const user = userEvent.setup();

    await user.press(await screen.findByRole('button', { name: 'Next month' }));
    expect(await screen.findByText('November 2026')).toBeTruthy();
    expect(getCalendar).toHaveBeenCalledWith('2026-11-01', '2026-11-30');
    // A multi-day event shows on each of its days.
    expect(screen.getByRole('button', { name: /^2026-11-05, Items: 1/ })).toBeTruthy();

    await user.press(screen.getByRole('button', { name: 'Previous month' }));
    expect(await screen.findByText('October 2026')).toBeTruthy();
    await user.press(screen.getByRole('button', { name: 'Previous month' }));
    expect(await screen.findByText('September 2026')).toBeTruthy();
  });

  it('offers a way back to today after leaving the month', async () => {
    await render(<CalendarScreen />, { wrapper });
    const user = userEvent.setup();
    expect(screen.queryByRole('button', { name: 'Go to today' })).toBeNull();

    await user.press(await screen.findByRole('button', { name: 'Next month' }));
    await user.press(await screen.findByRole('button', { name: 'Go to today' }));
    expect(await screen.findByText('October 2026')).toBeTruthy();
    expect(screen.getByText('On 2026-10-23')).toBeTruthy();
  });

  it('lists the upcoming events and holidays (not leave) and the latest notices below the calendar', async () => {
    await render(<CalendarScreen />, { wrapper });

    expect(await screen.findByText('Upcoming events')).toBeTruthy();
    expect(getCalendar).toHaveBeenCalledWith('2026-10-23', '2026-12-22'); // today + 60 days
    await waitFor(() => expect(screen.getAllByText('Parents meeting').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Sports week').length).toBeGreaterThan(0);
    expect(screen.queryByText('Sita: Casual')).toBeNull();

    expect(screen.getByText('School notices')).toBeTruthy();
    expect(await screen.findByText('Fee notice')).toBeTruthy();
    expect(screen.getByText('Please pay before Friday.')).toBeTruthy();
    expect(getNotices).toHaveBeenCalledWith(5);
  });

  it('expands and collapses a notice', async () => {
    await render(<CalendarScreen />, { wrapper });
    const user = userEvent.setup();

    await user.press(await screen.findByRole('button', { name: 'Show more: Fee notice' }));
    expect(screen.getByRole('button', { name: 'Show less: Fee notice' })).toBeTruthy();
  });

  it('draws the month in the Bikram Sambat calendar when the school uses it', async () => {
    jest.mocked(getTenantSettings).mockResolvedValue({ calendarPreference: 'nepali' });
    await render(<CalendarScreen />, { wrapper });

    expect(await screen.findByText('Kartik 2083')).toBeTruthy();
    // The API is still asked in AD: the month's first and last day.
    const [from, to] = jest.mocked(getCalendar).mock.calls[0]!;
    expect(from <= '2026-10-23' && '2026-10-23' <= to).toBe(true);
    expect(from).not.toBe('2026-10-01');
    expect(screen.getByText('On 2083-07-06')).toBeTruthy();
  });

  it('shows empty states for no events and no notices', async () => {
    jest.mocked(getCalendar).mockImplementation(async (from, to) => ({ from, to, items: [], weeklyOff: [] }));
    jest.mocked(getNotices).mockResolvedValue({ rows: [], total: 0 });
    await render(<CalendarScreen />, { wrapper });

    expect(await screen.findByText('No upcoming events.')).toBeTruthy();
    expect(await screen.findByText('No notices.')).toBeTruthy();
    expect(screen.getByText('Nothing is scheduled on this day.')).toBeTruthy();
  });

  it('says there is no access on a 403 for the calendar, and shows nothing of the notices', async () => {
    jest.mocked(getCalendar).mockRejectedValue(new ApiError(403, 'You do not have permission (calendar.read)'));
    await render(<CalendarScreen />, { wrapper });

    await waitFor(() => expect(screen.getByText("You don't have access to this section.")).toBeTruthy());
    expect(screen.queryByText('School notices')).toBeNull();
  });

  it('hides the notices, and keeps the calendar, when only the notices are refused', async () => {
    jest.mocked(getNotices).mockRejectedValue(new ApiError(403, 'No access'));
    await render(<CalendarScreen />, { wrapper });

    expect(await screen.findByText('October 2026')).toBeTruthy();
    await waitFor(() => expect(getNotices).toHaveBeenCalled());
    expect(screen.queryByText('Fee notice')).toBeNull();
    expect(screen.queryByText("You don't have access to this section.")).toBeNull();
  });

  it('keeps the saved month and says so when a refresh fails offline', async () => {
    client.setQueryData(tenantSettingsKey('t1'), { calendarPreference: 'gregorian' });
    client.setQueryData(
      calendarKey('t1', '2026-10-01', '2026-10-31'),
      { from: '2026-10-01', to: '2026-10-31', items: FEED, weeklyOff: [6] } satisfies CalendarFeed,
      { updatedAt: Date.now() - 60 * 60 * 1000 },
    );
    jest.mocked(getCalendar).mockRejectedValue(new ApiError(0, 'offline', NETWORK_ERROR_CODE));
    await render(<CalendarScreen />, { wrapper });

    expect(await screen.findByText('October 2026')).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/Showing saved data from/)).toBeTruthy());
    expect(screen.getAllByText('Science fair').length).toBeGreaterThan(0);
  });

  it('offers a retry when the calendar cannot be loaded for another reason', async () => {
    jest.mocked(getCalendar).mockRejectedValue(new ApiError(500, 'boom'));
    await render(<CalendarScreen />, { wrapper });

    expect(await screen.findByText('Could not load this section.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});
