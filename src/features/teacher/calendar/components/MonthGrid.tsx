import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { CalendarItem } from '../../../../api/types/calendar';
import { Text } from '../../../../components/Text';
import { t } from '../../../../i18n';
import { type CalendarPreference, formatDate } from '../../../../lib/date';
import { MIN_TOUCH_TARGET } from '../../../../theme/tokens';
import { useTheme } from '../../../../theme/useTheme';
import { colorFor, type DayCell, itemsOn, type MonthLayout } from '../calendarModel';

const WEEKDAY_KEYS = [
  'calendar.weekday.0',
  'calendar.weekday.1',
  'calendar.weekday.2',
  'calendar.weekday.3',
  'calendar.weekday.4',
  'calendar.weekday.5',
  'calendar.weekday.6',
] as const;

/** At most this many marks under a day number; the list below the grid shows everything. */
const MAX_MARKS = 3;

export interface MonthGridProps {
  layout: MonthLayout;
  items: readonly CalendarItem[];
  /** Weekdays the school has switched off (0 = Sunday). */
  weeklyOff: readonly number[];
  today: string;
  selected: string;
  calendar: CalendarPreference;
  onSelect: (iso: string) => void;
}

interface DayProps {
  cell: DayCell;
  dayItems: readonly CalendarItem[];
  off: boolean;
  isToday: boolean;
  isSelected: boolean;
  calendar: CalendarPreference;
  onSelect: (iso: string) => void;
}

/** One day: its number, up to three coloured marks, and a state that never relies on colour alone (ring = today, fill = selected). */
const Day = memo(function Day({ cell, dayItems, off, isToday, isSelected, calendar, onSelect }: DayProps) {
  const { colors, radius } = useTheme();
  const holiday = dayItems.some((item) => item.kind === 'holiday');
  const label = [
    formatDate(cell.iso, calendar),
    holiday ? t('calendar.kind.holiday') : null,
    dayItems.length > 0 ? t('calendar.itemCount', { count: dayItems.length }) : null,
    off ? t('calendar.weeklyOff') : null,
  ]
    .filter(Boolean)
    .join(', ');
  const numberColor = isSelected ? colors.onAccent : holiday ? colors.destructive : off ? colors.textMuted : colors.text;

  return (
    <Pressable
      onPress={() => onSelect(cell.iso)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
      style={styles.cellOuter}
    >
      <View
        style={[
          styles.cell,
          {
            borderRadius: radius.lg,
            borderColor: isToday ? colors.accent : 'transparent',
            backgroundColor: isSelected ? colors.accent : 'transparent',
          },
        ]}
      >
        <Text style={{ color: numberColor, fontWeight: isToday || isSelected ? '700' : '400' }}>{cell.day}</Text>
        <View style={styles.marks}>
          {dayItems.slice(0, MAX_MARKS).map((item) => (
            <View
              key={`${item.kind}:${item.id}`}
              style={[styles.mark, { backgroundColor: isSelected ? colors.onAccent : colorFor(item.color, colors) }]}
            />
          ))}
        </View>
      </View>
    </Pressable>
  );
});

/**
 * One month as seven columns. A pure view over the layout it is given: it computes no date and decides nothing about
 * who sees what. Rows are `Pressable`s of at least 44pt, so the days stay reachable at large font sizes.
 */
export function MonthGrid({ layout, items, weeklyOff, today, selected, calendar, onSelect }: MonthGridProps) {
  const { colors, spacing } = useTheme();
  return (
    <View accessibilityLabel={layout.title} style={{ gap: spacing.xs }}>
      <View style={styles.row}>
        {WEEKDAY_KEYS.map((key, weekday) => (
          <View key={key} style={styles.cellOuter}>
            <Text variant="caption" tone="muted" style={{ textAlign: 'center', fontWeight: weeklyOff.includes(weekday) ? '400' : '600' }}>
              {t(key)}
            </Text>
          </View>
        ))}
      </View>
      {layout.weeks.map((week, index) => (
        <View key={`${layout.first}:${index}`} style={styles.row}>
          {week.map((cell, column) =>
            cell ? (
              <Day
                key={cell.iso}
                cell={cell}
                dayItems={itemsOn(items, cell.iso)}
                off={weeklyOff.includes(cell.weekday)}
                isToday={cell.iso === today}
                isSelected={cell.iso === selected}
                calendar={calendar}
                onSelect={onSelect}
              />
            ) : (
              <View key={`blank:${column}`} style={styles.cellOuter} />
            ),
          )}
        </View>
      ))}
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  cellOuter: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: MIN_TOUCH_TARGET },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '92%',
    minHeight: MIN_TOUCH_TARGET,
    borderWidth: 2,
  },
  marks: { flexDirection: 'row', gap: 2, height: 6, alignItems: 'center' },
  mark: { width: 6, height: 6, borderRadius: 3 },
});
