import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, useWindowDimensions, View } from 'react-native';

import { t } from '../i18n';
import { useTheme } from '../theme/useTheme';
import { BrandLogo } from './BrandLogo';
import { CurvedHeader } from './CurvedHeader';
import { Text } from './Text';

/** How much of the screen height the brand banner takes (the Sign-in reference: a bit over a third). */
const BANNER_SHARE = 0.36;
const LOGO_SIZE = 96;

/**
 * The layout of every signed-out screen (Sign-in reference): the curved brand banner with the logo, the app name and the
 * screen's `title`, then the form on the sheet below. Scrolls, so the form stays reachable with the keyboard open and at
 * large font sizes.
 */
export function AuthScreen({ title, children }: { title: string; children: ReactNode }) {
  const { colors, spacing } = useTheme();
  const { height } = useWindowDimensions();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <CurvedHeader style={{ minHeight: height * BANNER_SHARE, justifyContent: 'center' }}>
            <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl }}>
              <BrandLogo size={LOGO_SIZE} />
              <Text variant="headline" tone="inverse">
                {t('auth.brand')}
              </Text>
              <Text variant="title" tone="inverse" accessibilityRole="header">
                {title}
              </Text>
            </View>
          </CurvedHeader>
          <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.xl, gap: spacing.lg }}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
