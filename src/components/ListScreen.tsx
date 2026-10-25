import type { ReactNode } from 'react';
import { SectionList, type SectionListProps, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { gutter } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

export type ListScreenProps<ItemT, SectionT> = SectionListProps<ItemT, SectionT> & {
  /** A fixed bar under the list (e.g. a Save button) that stays on screen while the list scrolls. */
  footer?: ReactNode;
};

/**
 * Safe area + a virtualized `SectionList` for lists that can grow (UI_SYSTEM §2; the planned
 * FlashList is not adopted: it would be a new dependency). Takes the `SectionList` props as-is;
 * pass `refreshing` + `onRefresh` for pull-to-refresh. Do not nest it in `Screen` (a ScrollView).
 */
export function ListScreen<ItemT, SectionT = { data: readonly ItemT[] }>({
  footer,
  ...props
}: ListScreenProps<ItemT, SectionT>) {
  const { colors, spacing } = useTheme();
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: colors.bg }]}>
      <SectionList
        stickySectionHeadersEnabled={false}
        {...props}
        contentContainerStyle={[
          { paddingHorizontal: gutter, paddingVertical: spacing.lg, gap: spacing.sm },
          props.contentContainerStyle,
        ]}
      />
      {footer ? (
        <View
          style={{
            paddingHorizontal: gutter,
            paddingVertical: spacing.lg,
            gap: spacing.xs,
            backgroundColor: colors.bg,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
          }}
        >
          {footer}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
