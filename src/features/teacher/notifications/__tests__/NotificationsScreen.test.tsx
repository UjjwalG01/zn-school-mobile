import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ApiError, NETWORK_ERROR_CODE } from '../../../../api/errors';
import { getNotifications, markNotificationRead } from '../../../../api/notifications';
import { getTenantSettings } from '../../../../api/settings';
import type { AppNotification, NotificationPage } from '../../../../api/types/notifications';
import { resetSessionForTests, selectTenant } from '../../../../auth/session';
import { NotificationBell } from '../../../notifications/NotificationBell';
import { notificationsKey } from '../../../notifications/queries';
import { teacherCalendarFeature } from '../../calendar/manifest';
import NotificationsScreen from '../NotificationsScreen';

jest.mock('../../../../api/notifications');
jest.mock('../../../../api/settings');
const mockPush = jest.fn();
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, navigate: mockNavigate }) }));
let mockFeatures: unknown[] = [];
jest.mock('../../../useVisibleFeatures', () => ({ useVisibleFeatures: () => mockFeatures }));

const note = (id: string, type: string, readAt: string | null = null): AppNotification => ({
  id,
  type,
  referenceId: `ref-${id}`,
  title: `Title ${id}`,
  readAt,
  createdAt: '2026-10-22T08:00:00Z',
});

const PAGE: NotificationPage = {
  total: 3,
  unread: 2,
  rows: [note('1', 'school_event'), note('2', 'leave_decided'), note('3', 'notice_published', '2026-10-21T09:00:00Z')],
};

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeEach(() => {
  resetSessionForTests();
  selectTenant('t1');
  mockFeatures = [teacherCalendarFeature];
  // Mutations too: their default 5 min collection timer would keep the Jest worker alive after the run.
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
  jest.mocked(getNotifications).mockResolvedValue(PAGE);
  jest.mocked(markNotificationRead).mockImplementation(async (id) => ({ id, readAt: '2026-10-23T10:00:00Z' }));
  jest.mocked(getTenantSettings).mockResolvedValue({ calendarPreference: 'gregorian' });
});

afterEach(() => {
  client.clear();
  jest.clearAllMocks();
});

describe('NotificationsScreen', () => {
  it('lists the rows newest first with their kind, and marks unread ones', async () => {
    await render(<NotificationsScreen />, { wrapper });

    expect(await screen.findByText('Title 1')).toBeTruthy();
    expect(screen.getByText(/^School event · /)).toBeTruthy();
    expect(screen.getByText(/^Leave update · /)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Unread\. Title 1\./ })).toBeTruthy();
    // The read row has a destination, so it is still a button; its name has no "Unread".
    expect(screen.getByRole('button', { name: /^Title 3\./ })).toBeTruthy();
    expect(getNotifications).toHaveBeenCalledTimes(1);
  });

  it('opens the calendar for an event and marks it read, patching the cache without a refetch', async () => {
    await render(<NotificationsScreen />, { wrapper });
    const user = userEvent.setup();

    await user.press(await screen.findByRole('button', { name: /^Unread\. Title 1\./ }));

    expect(markNotificationRead).toHaveBeenCalledWith('1');
    expect(mockPush).toHaveBeenCalledWith('/teacher/more/calendar');
    await waitFor(() => expect(client.getQueryData<NotificationPage>(notificationsKey('t1'))?.unread).toBe(1));
    expect(screen.queryByRole('button', { name: /^Unread\. Title 1\./ })).toBeNull();
    expect(getNotifications).toHaveBeenCalledTimes(1);
  });

  it('only marks read when the app has no screen for the notification', async () => {
    await render(<NotificationsScreen />, { wrapper });
    const user = userEvent.setup();

    await user.press(await screen.findByRole('button', { name: /^Unread\. Title 2\./ }));

    expect(markNotificationRead).toHaveBeenCalledWith('2');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('does not make a read row with nowhere to go a button', async () => {
    jest.mocked(getNotifications).mockResolvedValue({
      total: 1,
      unread: 0,
      rows: [note('9', 'leave_decided', '2026-10-21T09:00:00Z')],
    });
    await render(<NotificationsScreen />, { wrapper });

    expect(await screen.findByText('Title 9')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Title 9/ })).toBeNull();
  });

  it('does not open the calendar when this teacher cannot see it', async () => {
    mockFeatures = [];
    await render(<NotificationsScreen />, { wrapper });
    const user = userEvent.setup();

    await user.press(await screen.findByRole('button', { name: /^Unread\. Title 1\./ }));

    expect(markNotificationRead).toHaveBeenCalledWith('1');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('keeps the row unread when marking it read fails', async () => {
    jest.mocked(markNotificationRead).mockRejectedValue(new ApiError(500, 'boom'));
    await render(<NotificationsScreen />, { wrapper });
    const user = userEvent.setup();

    await user.press(await screen.findByRole('button', { name: /^Unread\. Title 2\./ }));

    await waitFor(() => expect(markNotificationRead).toHaveBeenCalledWith('2'));
    await waitFor(() => expect(client.isMutating()).toBe(0));
    expect(client.getQueryData<NotificationPage>(notificationsKey('t1'))?.unread).toBe(2);
    expect(screen.getByRole('button', { name: /^Unread\. Title 2\./ })).toBeTruthy();
  });

  it('says so when there is nothing yet', async () => {
    jest.mocked(getNotifications).mockResolvedValue({ total: 0, unread: 0, rows: [] });
    await render(<NotificationsScreen />, { wrapper });

    expect(await screen.findByText('No notifications yet.')).toBeTruthy();
  });

  it('offers a retry when the inbox cannot be loaded', async () => {
    jest.mocked(getNotifications).mockRejectedValueOnce(new ApiError(0, 'offline', NETWORK_ERROR_CODE));
    await render(<NotificationsScreen />, { wrapper });
    const user = userEvent.setup();

    await user.press(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Title 1')).toBeTruthy();
  });

  it('notes when only the newest rows are shown', async () => {
    jest.mocked(getNotifications).mockResolvedValue({ ...PAGE, total: 120 });
    await render(<NotificationsScreen />, { wrapper });

    expect(await screen.findByText('Showing the newest 30 of 120.')).toBeTruthy();
  });
});

describe('NotificationBell', () => {
  it('shows the unread count, names it for a screen reader and opens the inbox', async () => {
    await render(<NotificationBell href="/teacher/more/notifications" />, { wrapper });
    const user = userEvent.setup();

    expect(await screen.findByText('2')).toBeTruthy();
    await user.press(screen.getByRole('button', { name: 'Notifications, 2 unread' }));
    expect(mockNavigate).toHaveBeenCalledWith('/teacher/more/notifications');
  });

  it('shows no badge when nothing is unread', async () => {
    jest.mocked(getNotifications).mockResolvedValue({
      total: 1,
      unread: 0,
      rows: [note('1', 'school_event', '2026-10-21T09:00:00Z')],
    });
    await render(<NotificationBell href="/teacher/more/notifications" />, { wrapper });

    await waitFor(() => expect(getNotifications).toHaveBeenCalled());
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeTruthy();
    expect(screen.queryByText('0')).toBeNull();
  });

  it('shows the bell without a badge when the inbox cannot be read', async () => {
    jest.mocked(getNotifications).mockRejectedValue(new ApiError(403, 'no'));
    await render(<NotificationBell href="/teacher/more/notifications" />, { wrapper });

    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeTruthy();
  });

  it('costs one request together with the list screen (they share the inbox query)', async () => {
    await render(
      <>
        <NotificationBell href="/teacher/more/notifications" />
        <NotificationsScreen />
      </>,
      { wrapper },
    );

    expect(await screen.findByText('Title 1')).toBeTruthy();
    expect(getNotifications).toHaveBeenCalledTimes(1);
  });
});
