// State and reads of the Academic Calendar, shared by its own screen and the teacher Dashboard so both draw the same month
// from the same cache entries (one request each, none when warm). `enabled = false` keeps every request off (no `calendar.read`).
import { useMemo, useState } from 'react';

import type { CalendarItem } from '../../../api/types/calendar';
import { savedDataTimestamp } from '../../../components/OfflineBanner';
import { type QueryStateSource, queryView } from '../../../components/QueryState';
import { type CalendarPreference, shiftIsoDate, todayIso } from '../../../lib/date';
import { useRefreshSchoolsOnFeatureDenied } from '../../featureDenied';
import { useTenantSettings } from '../../queries';
import { itemsOn, layoutMonth, type MonthRef, monthOf, shiftMonthRef, upcomingItems } from '../../calendar/calendarModel';
import { UPCOMING_DAYS, useCalendarWindow, useNotices } from './queries';

/** How many upcoming events are listed. */
const UPCOMING_LIMIT = 5;
const NO_ITEMS: readonly CalendarItem[] = [];
const NO_OFF_DAYS: readonly number[] = [];

export function useCalendarBoard(enabled = true) {
  const settings = useTenantSettings();
  const calendar: CalendarPreference = settings.data?.calendarPreference ?? 'gregorian';
  const today = todayIso();

  const [anchor, setAnchor] = useState<MonthRef | null>(null);
  const [selected, setSelected] = useState(today);
  const ref = anchor ?? monthOf(today, calendar);
  const layout = useMemo(() => layoutMonth(ref, calendar), [ref, calendar]);
  const previous = shiftMonthRef(ref, -1, calendar);
  const next = shiftMonthRef(ref, 1, calendar);

  // Wait for the school's calendar choice: drawing a Gregorian month first and a Bikram Sambat one a moment later would flash.
  const waitingForCalendar = settings.data === undefined && settings.error === null;
  const reads = enabled && !waitingForCalendar;
  const month = useCalendarWindow(layout.first, layout.last, reads);
  const upcoming = useCalendarWindow(today, shiftIsoDate(today, UPCOMING_DAYS), reads);
  const notices = useNotices(enabled);
  useRefreshSchoolsOnFeatureDenied(month.error, upcoming.error, notices.error);

  const monthItems = month.data?.items ?? NO_ITEMS;
  const weeklyOff = month.data?.weeklyOff ?? upcoming.data?.weeklyOff ?? NO_OFF_DAYS;
  const dayItems = useMemo(() => itemsOn(monthItems, selected), [monthItems, selected]);
  const comingUp = useMemo(
    () => upcomingItems(upcoming.data?.items ?? NO_ITEMS, today, UPCOMING_LIMIT),
    [upcoming.data, today],
  );

  const goTo = (target: MonthRef | null) => {
    if (!target) return;
    setAnchor(target);
    // Land on the 1st of the month shown, unless the selected day is already inside it.
    const nextLayout = layoutMonth(target, calendar);
    if (selected < nextLayout.first || selected > nextLayout.last) {
      setSelected(today >= nextLayout.first && today <= nextLayout.last ? today : nextLayout.first);
    }
  };
  const goToday = () => {
    setAnchor(monthOf(today, calendar));
    setSelected(today);
  };

  // What stands in for the month until it can be drawn: the settings while the calendar choice is unknown, else the month read.
  const gate: QueryStateSource = waitingForCalendar ? { data: undefined, error: null, refetch: settings.refetch } : month;
  return {
    calendar,
    today,
    layout,
    previous,
    next,
    selected,
    setSelected,
    goTo,
    goToday,
    showToday: layout.first > today || layout.last < today || selected !== today,
    month,
    upcoming,
    notices,
    monthItems,
    weeklyOff,
    dayItems,
    comingUp,
    gate,
    ready: !waitingForCalendar && queryView(month) === 'content',
    savedFrom: savedDataTimestamp([month, upcoming, notices]),
    /** Refetch only when `enabled`: `refetch()` runs the read even for a disabled query. */
    refetchAll: () => Promise.all([month.refetch(), upcoming.refetch(), notices.refetch()]),
  };
}

export type CalendarBoardState = ReturnType<typeof useCalendarBoard>;
