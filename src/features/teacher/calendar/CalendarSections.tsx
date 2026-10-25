// The blocks of the Academic Calendar, drawn from `useCalendarBoard`: the month with the tapped day, the events coming up
// and the latest notices. The Calendar screen stacks them; the teacher Dashboard stacks the same ones (`DashboardCalendar`).
// Read only: the app owns no event or notice, and the server decides what this person may see.
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import type { CalendarItem, Notice } from '../../../api/types/calendar';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { DateBadge } from '../../../components/DateBadge';
import { QueryState, queryView } from '../../../components/QueryState';
import { Stepper } from '../../../components/Stepper';
import { Text } from '../../../components/Text';
import { t } from '../../../i18n';
import { type CalendarPreference, formatDate, formatDayMonth, formatTimestamp } from '../../../lib/date';
import { useTheme } from '../../../theme/useTheme';
import { Section } from '../home/sections/Section';
import { colorFor, weekdayOf } from './calendarModel';
import { MonthGrid } from './components/MonthGrid';
import type { CalendarBoardState } from './useCalendarBoard';

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

/** The month (stepper, grid) and what is on the tapped day. Draw it once `board.ready`. */
export function CalendarBoard({ board }: { board: CalendarBoardState }) {
  const { spacing } = useTheme();
  const { calendar, selected, weeklyOff } = board;
  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.md }}>
        <Stepper
          label={board.layout.title}
          previousLabel={t('calendar.previousMonth')}
          nextLabel={t('calendar.nextMonth')}
          canGoBack={board.previous !== null}
          canGoForward={board.next !== null}
          onPrevious={() => board.goTo(board.previous)}
          onNext={() => board.goTo(board.next)}
        />
        {board.showToday ? <Button variant="link" title={t('calendar.today')} onPress={board.goToday} /> : null}
        <MonthGrid
          layout={board.layout}
          items={board.monthItems}
          weeklyOff={weeklyOff}
          today={board.today}
          selected={selected}
          calendar={calendar}
          onSelect={board.setSelected}
        />
      </View>
      <View style={{ gap: spacing.sm }}>
        <Text variant="title" accessibilityRole="header">
          {t('calendar.selectedDay', { date: formatDate(selected, calendar) })}
        </Text>
        {board.dayItems.length === 0 ? (
          <Text tone="muted">{weeklyOff.includes(weekdayOf(selected)) ? t('calendar.offDay') : t('calendar.nothingOnDay')}</Text>
        ) : (
          board.dayItems.map((item) => <ItemCard key={`${item.kind}:${item.id}`} item={item} calendar={calendar} />)
        )}
      </View>
    </View>
  );
}

export function UpcomingEvents({ board }: { board: CalendarBoardState }) {
  return (
    <Section
      title={t('calendar.upcoming')}
      query={board.upcoming}
      isEmpty={board.upcoming.data !== undefined && board.comingUp.length === 0}
      emptyText={t('calendar.nothingUpcoming')}
      hideOnForbidden
    >
      {board.comingUp.map((item) => (
        <ItemCard key={`up:${item.kind}:${item.id}`} item={item} calendar={board.calendar} />
      ))}
    </Section>
  );
}

export function NoticeList({ board }: { board: CalendarBoardState }) {
  const rows = board.notices.data?.rows ?? [];
  return (
    <Section
      title={t('calendar.notices')}
      query={board.notices}
      isEmpty={board.notices.data !== undefined && rows.length === 0}
      emptyText={t('calendar.noNotices')}
      hideOnForbidden
    >
      {rows.map((notice) => (
        <NoticeCard key={notice.id} notice={notice} calendar={board.calendar} />
      ))}
    </Section>
  );
}

/**
 * The Dashboard's calendar: a titled month with a link to the full page, then upcoming events and notices. A plain 403 on the
 * month hides all of it (the person has no calendar); other failures show inside the block and the rest of the Dashboard stays.
 */
export function DashboardCalendar({ board, onOpen }: { board: CalendarBoardState; onOpen?: () => void }) {
  const { spacing } = useTheme();
  if (queryView(board.gate, { hideOnForbidden: true }) === 'hidden') return null;
  return (
    <>
      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
          <Text variant="title" accessibilityRole="header">
            {t('calendar.title')}
          </Text>
          {onOpen ? <Button variant="link" title={t('dashboard.openCalendar')} onPress={onOpen} /> : null}
        </View>
        {board.ready ? (
          <CalendarBoard board={board} />
        ) : (
          <QueryState query={board.gate} hideOnForbidden>
            {null}
          </QueryState>
        )}
      </View>
      {board.ready ? (
        <>
          <UpcomingEvents board={board} />
          <NoticeList board={board} />
        </>
      ) : null}
    </>
  );
}
