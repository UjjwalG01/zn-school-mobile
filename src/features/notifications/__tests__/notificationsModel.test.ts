import type { AppNotification, NotificationPage } from '../../../api/types/notifications';
import { applyRead, badgeText, destinationFor, typeLabelKey } from '../notificationsModel';

const row = (id: string, readAt: string | null = null, type = 'school_event'): AppNotification => ({
  id,
  type,
  referenceId: `ref-${id}`,
  title: `Title ${id}`,
  readAt,
  createdAt: '2026-10-23T08:00:00Z',
});

describe('applyRead', () => {
  const page: NotificationPage = { rows: [row('a'), row('b', '2026-10-22T09:00:00Z')], total: 40, unread: 7 };

  it('stamps the row and lowers the badge by one', () => {
    const next = applyRead(page, 'a', '2026-10-23T10:00:00Z');
    expect(next.rows[0]!.readAt).toBe('2026-10-23T10:00:00Z');
    expect(next.unread).toBe(6);
    expect(next.total).toBe(40);
  });

  it('is idempotent: a row that is already read changes nothing', () => {
    expect(applyRead(page, 'b', '2026-10-23T10:00:00Z')).toBe(page);
    const once = applyRead(page, 'a', '2026-10-23T10:00:00Z');
    expect(applyRead(once, 'a', '2026-10-23T11:00:00Z')).toBe(once);
  });

  it('ignores a row that is not on the cached page (the badge counts rows beyond it, which a read cannot know)', () => {
    expect(applyRead(page, 'zzz', '2026-10-23T10:00:00Z')).toBe(page);
  });

  it('never goes below zero', () => {
    expect(applyRead({ ...page, unread: 0 }, 'a', '2026-10-23T10:00:00Z').unread).toBe(0);
  });
});

describe('destinationFor', () => {
  it('opens the calendar for an event or a notice when the calendar is available', () => {
    expect(destinationFor({ type: 'school_event' }, { calendarVisible: true })).toBe('calendar');
    expect(destinationFor({ type: 'notice_published' }, { calendarVisible: true })).toBe('calendar');
  });

  it('opens nothing without the calendar, or for a type this app has no screen for', () => {
    expect(destinationFor({ type: 'school_event' }, { calendarVisible: false })).toBeNull();
    for (const type of ['leave_submitted', 'leave_decided', 'student_absent', 'results_published', 'something_new']) {
      expect(destinationFor({ type }, { calendarVisible: true })).toBeNull();
    }
  });
});

describe('badgeText', () => {
  it('is empty for nothing unread, the count up to 99, and 99+ after', () => {
    expect(badgeText(0)).toBe('');
    expect(badgeText(-1)).toBe('');
    expect(badgeText(7)).toBe('7');
    expect(badgeText(99)).toBe('99');
    expect(badgeText(100)).toBe('99+');
  });
});

describe('typeLabelKey', () => {
  it('names each known type and falls back for an unknown one', () => {
    expect(typeLabelKey('school_event')).toBe('notifications.type.school_event');
    expect(typeLabelKey('brand_new_type')).toBe('notifications.type.other');
  });
});
