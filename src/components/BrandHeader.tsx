// An icon-set import from the Ionicons file only: the package barrel would bundle every icon font family.
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { t } from '../i18n';
import { gutter, iconSize, MIN_TOUCH_TARGET } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { CurvedHeader } from './CurvedHeader';
import { Text } from './Text';

export interface BrandHeaderProps {
  title: string;
  /** A back arrow shows only when this is given. */
  onBack?: () => void;
  /** An action at the end of the bar (the shell switcher). Use `inverse` buttons: the bar is the brand colour. */
  right?: ReactNode;
}

/** The page header of the Calendar reference: back arrow, title, an optional action, on the curved brand header. */
export function BrandHeader({ title, onBack, right }: BrandHeaderProps) {
  const { colors, spacing } = useTheme();
  return (
    <CurvedHeader>
      <View style={[styles.bar, { paddingHorizontal: gutter, paddingVertical: spacing.sm, gap: spacing.sm }]}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            style={[styles.back, { marginStart: -spacing.sm }]}
          >
            <Ionicons name="arrow-back" size={iconSize.lg} color={colors.textInverse} />
          </Pressable>
        ) : null}
        <Text variant="title" tone="inverse" accessibilityRole="header" numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        {right}
      </View>
    </CurvedHeader>
  );
}

/** The slice of a navigator's header props that the brand header reads (stack and tab headers both satisfy it). */
interface NavHeaderProps {
  options: { title?: string; headerRight?: (props: { tintColor?: string; canGoBack: boolean }) => ReactNode };
  route: { name: string };
  /** Present on a stack screen that has a screen under it. */
  back?: unknown;
  navigation: { goBack: () => void };
}

function NavHeader({ options, route, back, navigation, trailing }: NavHeaderProps & { trailing?: ReactNode }) {
  const action = options.headerRight?.({ canGoBack: Boolean(back) });
  return (
    <BrandHeader
      title={options.title ?? route.name}
      onBack={back ? () => navigation.goBack() : undefined}
      right={
        trailing ? (
          <>
            {action}
            {trailing}
          </>
        ) : (
          action
        )
      }
    />
  );
}

/**
 * `screenOptions` for every navigator (stack or tabs): the page header comes from the screen's `title` option and, when
 * there is a screen under it, a back arrow. A new page gets the layout by living under a layout that spreads this.
 */
export const brandHeaderOptions = { header: (props: NavHeaderProps) => <NavHeader {...props} /> };

/**
 * The same header with `trailing` as the last thing on the bar, after the screen's own action: the notification bell of a
 * signed-in shell. Every navigator of the shell (tabs and the nested stacks) spreads this, so the bell sits in the same
 * place wherever the header is shown and no screen draws its own.
 */
export const shellHeaderOptions = (trailing: ReactNode) => ({
  header: (props: NavHeaderProps) => <NavHeader {...props} trailing={trailing} />,
});

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', minHeight: MIN_TOUCH_TARGET + 12 },
  back: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1 },
});
