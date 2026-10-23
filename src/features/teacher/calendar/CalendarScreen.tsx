// Academic Calendar (teacher.calendar, in the More hub): the school's month with its events, holidays and the person's
// own approved leave marked, the day that was tapped, the events coming up and the latest notices. Read only: the app
// owns no event or notice, and the server decides what this person may see (audience, staff type, class assignment).
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import type { CalendarItem, Notice } from '../../../api/types/calendar';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { DateBadge } from '../../../components/DateBadge';
import { OfflineBanner, savedDataTimestamp } from '../../../components/OfflineBanner';
import { QueryState, queryView } from '../../../components/QueryState';
import { Screen } from '../../../components/Screen';
import { Stepper } from '../../../components/Stepper';
import { Text } from '../../../components/Text';
import { t } from '../../../i18n';
import {
  type CalendarPreference,
  formatDate,
  formatDayMonth,
  formatTimestamp,
  shiftIsoDate,
  todayIso,
} from '../../../lib/date';
import { useTheme } from '../../../theme/useTheme';
import { useRefreshSchoolsOnFeatureDenied } from '../../featureDenied';
import { useTenantSettings } from '../../queries';
import { useManualRefresh } from '../../useManualRefresh';
import {
  colorFor,
  itemsOn,
  layoutMonth,
  type MonthRef,
  monthOf,
  shiftMonthRef,
  upcomingItems,
  weekdayOf,
} from './calendarModel';
import { MonthGrid } from './components/MonthGrid';
import { UPCOMING_DAYS, useCalendarWindow, useNotices } from './queries';

/** How many upcoming events are listed. */
const UPCOMING_LIMIT = 5;
const NO_ITEMS: readonly CalendarItem[] = [];
const NO_OFF_DAYS: readonly number[] = [];

const KIND_KEY = {
  event: 'calendar.kind.event',
  holiday: 'calendar.kind.holiday',
  leave: 'calendar.kind.leave',
} as const;

/** "2083-06-12" or "2083-06-12 – 2083-06-14", in the school's calendar. */
function rangeText(item: CalendarItem, calendar: CalendarPreference): string {
  const start = formatDate(item.startDate, calendar);
  return item.endDate === item.startDate ? start : t('calendar.range', { from: start, to: formatDate(item.endDate, calendar) });
}

/** A date badge and a tinted card, as the Calendar reference lists events. The kind is written in the card, so colour is not the only signal. */
function ItemCard({ item, calendar }: { item: CalendarItem; calendar: CalendarPreference }) {
  const { colors, spacing } = useTheme();
  const color = colorFor(item.color, colors);
  const { day, month } = formatDayMonth(item.startDate, calendar);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <DateBadge day={day} month={month} color={color} />
      <View style={{ flex: 1 }}>
        <Card tint={color}>
          <Text variant="bodyLarge" style={{ fontWeight: '600' }}>
            {item.title}
          </Text>
          <Text variant="caption" tone="muted">
            {[t(KIND_KEY[item.kind]), item.typeLabel, rangeText(item, calendar)].filter((part, i, all) => part && all.indexOf(part) === i).join(' · ')}
          </Text>
          {item.description ? <Text variant="body">{item.description}</Text> : null}
        </Card>
      </View>
    </View>
  );
}

function NoticeCard({ notice, calendar }: { notice: Notice; calendar: CalendarPreference }) {
  const { spacing } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <Text variant="bodyLarge" style={{ fontWeight: '600' }}>
        {notice.title}
      </Text>
      <Text variant="caption" tone="muted">
        {formatTimestamp(Date.parse(notice.publishedAt), calendar)}
      </Text>
      <Text variant="body" numberOfLines={open ? undefined : 3}>
        {notice.body}
      </Text>
      <Pressable
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityLabel={`${open ? t('calendar.showLess') : t('calendar.showMore')}: ${notice.title}`}
        style={{ paddingVertical: spacing.xs }}
      >
        <Text variant="caption" tone="brand">
          {open ? t('calendar.showLess') : t('calendar.showMore')}
        </Text>
      </Pressable>
    </Card>
  );
}

export default function CalendarScreen() {
  const { spacing } = useTheme();
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
  const month = useCalendarWindow(layout.first, layout.last, !waitingForCalendar);
  const upcoming = useCalendarWindow(today, shiftIsoDate(today, UPCOMING_DAYS), !waitingForCalendar);
  const notices = useNotices();
  useRefreshSchoolsOnFeatureDenied(month.error, upcoming.error, notices.error);
  const { refreshing, onRefresh } = useManualRefresh(() =>
    Promise.all([month.refetch(), upcoming.refetch(), notices.refetch()]),
  );

  const monthItems = month.data?.items ?? NO_ITEMS;
  const weeklyOff = month.data?.weeklyOff ?? upcoming.data?.weeklyOff ?? NO_OFF_DAYS;
  const dayItems = useMemo(() => itemsOn(monthItems, selected), [monthItems, selected]);
  const comingUp = useMemo(
    () => upcomingItems(upcoming.data?.items ?? NO_ITEMS, today, UPCOMING_LIMIT),
    [upcoming.data, today],
  );
  const savedFrom = savedDataTimestamp([month, upcoming, notices]);
  const showToday = layout.first > today || layout.last < today || selected !== today;

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

  if (waitingForCalendar || queryView(month) !== 'content') {
    return (
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <QueryState query={waitingForCalendar ? { data: undefined, error: null, refetch: settings.refetch } : month}>{null}</QueryState>
      </Screen>
    );
  }

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <View style={{ gap: spacing.md }}>
        <Stepper
          label={layout.title}
          previousLabel={t('calendar.previousMonth')}
          nextLabel={t('calendar.nextMonth')}
          canGoBack={previous !== null}
          canGoForward={next !== null}
          onPrevious={() => goTo(previous)}
          onNext={() => goTo(next)}
        />
        {showToday ? <Button variant="link" title={t('calendar.today')} onPress={goToday} /> : null}
        <OfflineBanner asOf={savedFrom} />
        <MonthGrid
          layout={layout}
          items={monthItems}
          weeklyOff={weeklyOff}
          today={today}
          selected={selected}
          calendar={calendar}
          onSelect={setSelected}
        />
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text variant="title" accessibilityRole="header">
          {t('calendar.selectedDay', { date: formatDate(selected, calendar) })}
        </Text>
        {dayItems.length === 0 ? (
          <Text tone="muted">{weeklyOff.includes(weekdayOf(selected)) ? t('calendar.offDay') : t('calendar.nothingOnDay')}</Text>
        ) : (
          dayItems.map((item) => <ItemCard key={`${item.kind}:${item.id}`} item={item} calendar={calendar} />)
        )}
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text variant="title" accessibilityRole="header">
          {t('calendar.upcoming')}
        </Text>
        <QueryState query={upcoming} isEmpty={upcoming.data !== undefined && comingUp.length === 0} emptyText={t('calendar.nothingUpcoming')} hideOnForbidden>
          {comingUp.map((item) => (
            <ItemCard key={`up:${item.kind}:${item.id}`} item={item} calendar={calendar} />
          ))}
        </QueryState>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text variant="title" accessibilityRole="header">
          {t('calendar.notices')}
        </Text>
        <QueryState query={notices} isEmpty={notices.data !== undefined && notices.data.rows.length === 0} emptyText={t('calendar.noNotices')} hideOnForbidden>
          {(notices.data?.rows ?? []).map((notice) => (
            <NoticeCard key={notice.id} notice={notice} calendar={calendar} />
          ))}
        </QueryState>
      </View>
    </Screen>
  );
}
