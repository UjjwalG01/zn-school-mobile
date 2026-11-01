// Guardian Home: a greeting on the brand colour, the children, the school's month (the teacher calendar's grid, reused), the latest
// notice, then the family advance when one exists. Home makes no per-child requests: its reads are the children list, the month's
// calendar, the notices and the advance, the same for every child. A child's own figures stay on that child's tabs.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import type { GuardianStudent } from '../../api/portal';
import type { CalendarItem } from '../../api/types/calendar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DateBadge } from '../../components/DateBadge';
import { QueryState } from '../../components/QueryState';
import { Screen } from '../../components/Screen';
import { StatusBadge } from '../../components/StatusBadge';
import { Stepper } from '../../components/Stepper';
import { Text } from '../../components/Text';
import { t } from '../../i18n';
import { formatDayMonth, todayIso } from '../../lib/date';
import { formatMoney } from '../../lib/money';
import { gutter, iconSize, withAlpha } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { itemsOn, layoutMonth, type MonthRef, monthOf, shiftMonthRef } from '../calendar/calendarModel';
import { MonthGrid } from '../calendar/MonthGrid';
import { useTenantSettings } from '../queries';
import { useGuardianChild } from './GuardianChildContext';
import { GUARDIAN_NOTICES_HREF, guardianCalendarHref, guardianStudentHref } from './routes';
import { useGuardianAdvance, useGuardianCalendar, useGuardianNotices } from './queries';
import { CalendarBoard } from '../teacher/calendar/CalendarSections';

/** The round tile behind a child's or a notice's icon. */
const TILE = 56;
const TILE_OPACITY = 0.14;

function greetingKey(hour: number): 'guardian.home.greetingMorning' | 'guardian.home.greetingAfternoon' | 'guardian.home.greetingEvening' {
  if (hour < 12) return 'guardian.home.greetingMorning';
  return hour < 17 ? 'guardian.home.greetingAfternoon' : 'guardian.home.greetingEvening';
}

function Tile({ icon }: { icon: 'person' | 'megaphone' }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: TILE,
        height: TILE,
        borderRadius: TILE / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: withAlpha(colors.accent, TILE_OPACITY),
      }}
    >
      <Ionicons name={icon} size={iconSize.lg} color={colors.accent} />
    </View>
  );
}

function StudentCard({ student }: { student: GuardianStudent }) {
  const router = useRouter();
  const { spacing } = useTheme();
  const { select } = useGuardianChild();
  const placed = Boolean(student.className);
  const placement = student.className
    ? t('guardian.home.placement', {
      className: student.className,
      sectionName: student.sectionName ? ` · ${student.sectionName}` : '',
    })
    : t('guardian.home.noPlacement');
  // Opening a child also makes that child the one the tabs show.
  const open = () => {
    select(student.studentId);
    router.push(guardianStudentHref(student.studentId));
  };
  return (
    <Card onPress={open} accessibilityLabel={student.fullName}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Tile icon="person" />
        <View style={{ flex: 1, gap: spacing.xs, alignItems: 'flex-start' }}>
          <Text variant="title">{student.fullName}</Text>
          <Text tone="muted">{student.admissionNumber}</Text>
          {/* The label carries the meaning; the tone only adds the colour dot. */}
          <StatusBadge label={placement} tone={placed ? 'success' : 'warning'} />
        </View>
      </View>
    </Card>
  );
}

function UpcomingRow({ item, calendar }: { item: CalendarItem; calendar: 'gregorian' | 'nepali' }) {
  const { colors, spacing } = useTheme();
  const { day, month } = formatDayMonth(item.startDate, calendar);
  return (
    <Card chevron={false} accessibilityLabel={item.title}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <DateBadge day={day} month={month} color={item.kind === 'holiday' ? colors.textMuted : colors.accent} />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text variant="title">{item.title}</Text>
          <Text tone="muted">{item.typeLabel}</Text>
        </View>
      </View>
    </Card>
  );
}

/** The school's month with the tapped day's events under it. Month reads are keyed by the month's window (Daily class). */
function CalendarBlock() {
  const router = useRouter();
  const { spacing } = useTheme();
  const calendar = useTenantSettings().data?.calendarPreference ?? 'gregorian';
  const today = todayIso();
  const [ref, setRef] = useState<MonthRef>(() => monthOf(today, calendar));
  const [selected, setSelected] = useState(today);
  const layout = layoutMonth(ref, calendar);
  const query = useGuardianCalendar(layout.first, layout.last);
  const items = query.data?.items ?? [];
  const previous = shiftMonthRef(ref, -1, calendar);
  const next = shiftMonthRef(ref, 1, calendar);
  const dayItems = itemsOn(items, selected);

  // Moving the month selects its first day, so the list below never shows a day that is off the grid.
  const move = (to: MonthRef) => {
    setRef(to);
    setSelected(layoutMonth(to, calendar).first);
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="title">{t('guardian.home.calendar')}</Text>
        <Button
          title={t('guardian.home.openCalendar')}
          variant="link"
          onPress={() => router.navigate(guardianCalendarHref(selected))}
        />
      </View>
      <Card>
        <Stepper
          label={layout.title}
          previousLabel={t('guardian.calendar.previousMonth')}
          nextLabel={t('guardian.calendar.nextMonth')}
          canGoBack={previous !== null}
          canGoForward={next !== null}
          onPrevious={() => previous && move(previous)}
          onNext={() => next && move(next)}
        />
        <MonthGrid
          layout={layout}
          items={items}
          weeklyOff={query.data?.weeklyOff ?? []}
          today={today}
          selected={selected}
          calendar={calendar}
          onSelect={setSelected}
        />
      </Card>
      <QueryState query={query} isEmpty={dayItems.length === 0} emptyText={t('calendar.nothingOnDay')}>
        {dayItems.map((item) => (
          <UpcomingRow key={`${item.kind}-${item.id}`} item={item} calendar={calendar} />
        ))}
      </QueryState>
    </View>
  );
}

function NoticesBlock() {
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const query = useGuardianNotices();
  const latest = query.data?.rows[0];
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="title">{t('guardian.home.notices')}</Text>
      <QueryState query={query} isEmpty={!latest} emptyText={t('guardian.home.noticesEmpty')}>
        {latest ? (
          <Card onPress={() => router.navigate(GUARDIAN_NOTICES_HREF)} accessibilityLabel={latest.title}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Tile icon="megaphone" />
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text variant="title">{latest.title}</Text>
                <Text style={{ color: colors.accent }}>{t('guardian.home.seeAll')}</Text>
              </View>
            </View>
          </Card>
        ) : null}
      </QueryState>
    </View>
  );
}

/** Shown only when the server returns the guardian's own advance row; never added to a child's figures. */
function AdvanceBlock() {
  const query = useGuardianAdvance();
  const currencyCode = useTenantSettings().data?.currencyCode ?? null;
  const row = query.data?.[0];
  if (!row) return null;
  return (
    <Card chevron={false}>
      <Text variant="title">{t('guardian.home.advance')}</Text>
      <Text>{formatMoney(row.advance, currencyCode)}</Text>
      <Text tone="muted">{t('guardian.home.advanceNote')}</Text>
    </Card>
  );
}

export default function GuardianHomeScreen() {
  const { colors, spacing } = useTheme();
  const { query } = useGuardianChild();
  const students = query.data ?? [];

  return (
    <Screen refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      {/* Bleeds to the screen edges and up to the header, as the reference's greeting band does. */}
      <View
        style={{
          backgroundColor: colors.brand,
          marginHorizontal: -gutter,
          marginTop: -spacing.lg,
          paddingHorizontal: gutter,
          paddingVertical: spacing.lg,
          gap: spacing.xs,
        }}
      >
        <Text variant="title" tone="inverse" accessibilityRole="header">
          {t(greetingKey(new Date().getHours()))}
        </Text>
        <Text tone="inverse">{t('guardian.home.subtitle')}</Text>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text variant="title">{t('guardian.home.title')}</Text>
        {query.isPending ? <Text tone="muted">{t('common.loading')}</Text> : null}
        {query.isError ? (
          <View style={{ gap: spacing.sm }}>
            <Text tone="error">{t('guardian.home.error')}</Text>
            <Button title={t('common.retry')} variant="link" onPress={() => void query.refetch()} />
          </View>
        ) : null}
        {query.isSuccess && students.length === 0 ? <Text tone="muted">{t('guardian.home.empty')}</Text> : null}
        {students.map((student) => (
          <StudentCard key={student.studentId} student={student} />
        ))}
      </View>
      <CalendarBlock />
      <NoticesBlock />
      <AdvanceBlock />
    </Screen>
  );
}
