import type { CalendarItem } from '../../../api/types/calendar';
import { byStartDate, monthFor } from '../guardianCalendarModel';
import { guardianDestination } from '../inboxModel';

const LINKED = ['student-a', 'student-b'];

describe('guardian inbox destinations', () => {
  it('opens a linked child’s attendance for an absence, and nothing for a child not linked to this account', () => {
    expect(guardianDestination({ type: 'student_absent', referenceId: 'student-a', referenceDate: null }, LINKED)).toEqual({
      kind: 'attendance',
      studentId: 'student-a',
    });
    expect(guardianDestination({ type: 'student_absent', referenceId: 'stranger', referenceDate: null }, LINKED)).toBeNull();
  });

  it('opens the calendar on the day of an event or a holiday change, and on the month when the day is missing', () => {
    expect(guardianDestination({ type: 'school_event', referenceId: 'e1', referenceDate: '2026-11-05' }, LINKED)).toEqual({
      kind: 'calendar',
      day: '2026-11-05',
    });
    expect(guardianDestination({ type: 'holiday_changed', referenceId: 'h1', referenceDate: null }, LINKED)).toEqual({
      kind: 'calendar',
      day: null,
    });
  });

  it('opens the notices list for a notice; a result, leave or an unknown type opens nothing', () => {
    expect(guardianDestination({ type: 'notice_published', referenceId: 'n1', referenceDate: null }, LINKED)).toEqual({
      kind: 'notices',
    });
    expect(guardianDestination({ type: 'results_published', referenceId: 'x', referenceDate: null }, LINKED)).toBeNull();
    expect(guardianDestination({ type: 'leave_decided', referenceId: 'x', referenceDate: null }, LINKED)).toBeNull();
    expect(guardianDestination({ type: 'something_new', referenceId: 'x', referenceDate: null }, LINKED)).toBeNull();
  });
});

describe('guardian calendar helpers', () => {
  it('uses the day’s month when a notification names a day, and the current month otherwise', () => {
    expect(monthFor('2026-11-05', '2026-10-31')).toBe('2026-11');
    expect(monthFor(undefined, '2026-10-31')).toBe('2026-10');
    expect(monthFor('not-a-date', '2026-10-31')).toBe('2026-10');
  });

  it('sorts items by their first day and keeps every item', () => {
    const item = (id: string, startDate: string): CalendarItem => ({
      kind: 'event',
      id,
      title: id,
      typeLabel: 'Event',
      color: 'blue',
      startDate,
      endDate: startDate,
      description: null,
    });
    const sorted = byStartDate([item('late', '2026-11-20'), item('early', '2026-10-02'), item('mid', '2026-10-15')]);
    expect(sorted.map((i) => i.id)).toEqual(['early', 'mid', 'late']);
  });
});
