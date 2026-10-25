import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';

import { t } from '../i18n';
import { DISABLED_OPACITY, iconSize, MIN_TOUCH_TARGET } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { placeDropdown, type Rect } from './dropdownPlacement';
import { Text } from './Text';

export interface SelectOption {
  value: string;
  label: string;
  /** A second line: a state or a date ("Submitted", "Opens on …"). */
  hint?: string | null;
}

export interface SelectFieldProps {
  /** Always visible above the value, so the filter keeps its name once something is chosen. */
  label: string;
  /** The chosen option's `value`, or null for nothing chosen. */
  value: string | null;
  options: readonly SelectOption[];
  onChange: (value: string | null) => void;
  disabled?: boolean;
  /** Shown under a disabled field: why it is waiting ("Choose a class first"). */
  disabledHint?: string;
  /** Adds a first row that clears the choice (an optional filter such as the section). */
  clearLabel?: string;
}

/** What the list height is planned from before it is drawn: a row with a hint line is a little taller. */
const ROW_ESTIMATE = 48;
/** A long list scrolls inside this height rather than fill the screen. */
const MAX_LIST_HEIGHT = 320;

/**
 * One filter, the mobile counterpart of the web's `Dropdown`: a labelled field that opens its list of choices right under
 * it (over it, when there is no room below), as wide as the field. It is a core `Modal` with an absolutely placed list
 * (`placeDropdown`), so there is no new dependency; the modal also gives the dismissal (tap outside, Android back) and
 * keeps the list above every other screen. The caller keeps the value and decides what the other filters then offer; this
 * component knows nothing about exams or classes. Rows are at least 44pt, the chosen one carries a check as well as bold
 * text, and a disabled field says why.
 */
export function SelectField({
  label,
  value,
  options,
  onChange,
  disabled = false,
  disabledHint,
  clearLabel,
}: SelectFieldProps) {
  const { colors, spacing, radius } = useTheme();
  const screen = useWindowDimensions();
  const fieldRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Rect | null>(null);
  const chosen = options.find((option) => option.value === value);
  const shown = chosen?.label ?? t('filter.choose');

  const rows: SelectOption[] = clearLabel ? [{ value: '', label: clearLabel }, ...options] : [...options];
  const show = () => {
    setAnchor(null); // measured again each time: the field may have moved (scrolled, keyboard, a banner above)
    fieldRef.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height }));
    setOpen(true);
  };
  const pick = (next: string) => {
    onChange(next === '' ? null : next);
    setOpen(false);
  };

  // Until the field is measured (one frame) the list is laid out invisibly, so it never flashes in the wrong place.
  const insets = initialWindowMetrics?.insets;
  const placement = placeDropdown(
    anchor ?? { x: 0, y: 0, width: screen.width, height: MIN_TOUCH_TARGET },
    screen,
    Math.min(rows.length * ROW_ESTIMATE, MAX_LIST_HEIGHT),
    { top: (insets?.top ?? 0) + spacing.sm, bottom: (insets?.bottom ?? 0) + spacing.sm, side: spacing.sm },
  );

  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Pressable
        ref={fieldRef}
        onPress={show}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${shown}`}
        accessibilityState={{ disabled, expanded: open }}
        style={[
          styles.field,
          {
            minHeight: MIN_TOUCH_TARGET,
            paddingHorizontal: spacing.md,
            borderRadius: radius.lg,
            borderColor: open ? colors.accent : colors.border,
            backgroundColor: colors.card,
            opacity: disabled ? DISABLED_OPACITY : 1,
          },
        ]}
      >
        <Text variant="bodyLarge" tone={chosen ? 'default' : 'muted'} style={styles.value} numberOfLines={1}>
          {shown}
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={iconSize.md}
          color={colors.textMuted}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </Pressable>
      {disabled && disabledHint ? (
        <Text variant="caption" tone="muted">
          {disabledHint}
        </Text>
      ) : null}

      <Modal visible={open} animationType="fade" transparent statusBarTranslucent onRequestClose={() => setOpen(false)}>
        {/* Tapping anywhere outside the list closes it; screen-reader users get the same as a named button. */}
        <Pressable
          onPress={() => setOpen(false)}
          accessibilityRole="button"
          accessibilityLabel={t('filter.close')}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            styles.list,
            {
              ...placement,
              opacity: anchor ? 1 : 0,
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: radius.lg,
              shadowColor: colors.text,
            },
          ]}
        >
          <FlatList
            data={rows}
            keyExtractor={(row) => row.value || 'clear'}
            style={styles.scroll}
            renderItem={({ item }) => {
              const selected = item.value === '' ? value === null : item.value === value;
              return (
                <Pressable
                  onPress={() => pick(item.value)}
                  accessibilityRole="radio"
                  accessibilityLabel={item.hint ? `${item.label}, ${item.hint}` : item.label}
                  accessibilityState={{ checked: selected }}
                  style={[
                    styles.row,
                    {
                      minHeight: MIN_TOUCH_TARGET,
                      paddingHorizontal: spacing.md,
                      borderBottomColor: colors.border,
                      gap: spacing.sm,
                    },
                  ]}
                >
                  <View style={styles.value}>
                    <Text variant="bodyLarge" style={{ fontWeight: selected ? '700' : '400' }}>
                      {item.label}
                    </Text>
                    {item.hint ? (
                      <Text variant="caption" tone="muted">
                        {item.hint}
                      </Text>
                    ) : null}
                  </View>
                  {selected ? <Ionicons name="checkmark" size={iconSize.md} color={colors.accent} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: StyleSheet.hairlineWidth },
  value: { flex: 1 },
  list: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    elevation: 8,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  scroll: { flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
});
