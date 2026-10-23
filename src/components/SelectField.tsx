import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '../i18n';
import { DISABLED_OPACITY, MIN_TOUCH_TARGET } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
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

/**
 * One filter, the mobile counterpart of the web's `Dropdown`: a labelled field that opens a list of choices in a sheet
 * (core `Modal`, no new dependency). The caller keeps the value and decides what the other filters then offer; this
 * component knows nothing about exams or classes. Rows are at least 44pt, the chosen one carries a check as well as
 * bold text, and a disabled field says why.
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
  const [open, setOpen] = useState(false);
  const chosen = options.find((option) => option.value === value);
  const shown = chosen?.label ?? t('filter.choose');

  const rows: SelectOption[] = clearLabel ? [{ value: '', label: clearLabel }, ...options] : [...options];
  const pick = (next: string) => {
    onChange(next === '' ? null : next);
    setOpen(false);
  };

  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${shown}`}
        accessibilityState={{ disabled }}
        style={[
          styles.field,
          {
            minHeight: MIN_TOUCH_TARGET,
            paddingHorizontal: spacing.md,
            borderRadius: radius.lg,
            borderColor: colors.border,
            backgroundColor: colors.card,
            opacity: disabled ? DISABLED_OPACITY : 1,
          },
        ]}
      >
        <Text variant="bodyLarge" tone={chosen ? 'default' : 'muted'} style={styles.value} numberOfLines={1}>
          {shown}
        </Text>
        <Ionicons name="chevron-down" size={20} color={colors.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
      </Pressable>
      {disabled && disabledHint ? (
        <Text variant="caption" tone="muted">
          {disabledHint}
        </Text>
      ) : null}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          {/* The scrim is the text colour at low opacity (no literal colour); tapping it closes the sheet. */}
          <Pressable
            onPress={() => setOpen(false)}
            accessible={false}
            importantForAccessibility="no"
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.text, opacity: 0.4 }]}
          />
          <SafeAreaView style={[styles.sheet, { backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }]}>
            <View style={[styles.sheetHeader, { padding: spacing.lg, gap: spacing.md }]}>
              <Text variant="title" accessibilityRole="header" style={styles.value}>
                {label}
              </Text>
              <Pressable
                onPress={() => setOpen(false)}
                accessibilityRole="button"
                accessibilityLabel={t('filter.close')}
                style={styles.close}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <FlatList
              data={rows}
              keyExtractor={(row) => row.value || 'clear'}
              contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}
              renderItem={({ item }) => {
                const selected = (item.value === '' ? value === null : item.value === value);
                return (
                  <Pressable
                    onPress={() => pick(item.value)}
                    accessibilityRole="radio"
                    accessibilityLabel={item.hint ? `${item.label}, ${item.hint}` : item.label}
                    accessibilityState={{ checked: selected }}
                    style={[
                      styles.row,
                      { minHeight: MIN_TOUCH_TARGET, borderBottomColor: colors.border, gap: spacing.sm },
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
                    {selected ? <Ionicons name="checkmark" size={22} color={colors.accent} /> : null}
                  </Pressable>
                );
              }}
            />
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: StyleSheet.hairlineWidth },
  value: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '75%' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
});
