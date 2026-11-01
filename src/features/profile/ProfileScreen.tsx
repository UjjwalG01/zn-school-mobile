// Profile tab: who is signed in, which school is open, the app's language and light/dark choice, and the two account actions
// (Switch school, Sign out). Always visible, so a school that switches every module off can never lock the user in.
// Both actions are the existing session machinery: `chooseSchool` drops the old school's cache,
// `logout` wipes tokens, context, the persisted cache and downloaded files. The tab header already
// says "Profile", and the license is the administrator's business, so neither is repeated here.
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { AccountActions } from '../../components/AccountActions';
import { Card } from '../../components/Card';
import { LanguageSwitch } from '../../components/LanguageSwitch';
import { Screen } from '../../components/Screen';
import { ShellSwitcher } from '../../components/ShellSwitcher';
import { Text } from '../../components/Text';
import { ThemeSwitch } from '../../components/ThemeSwitch';
import { useMe, useMySchools } from '../../auth/queries';
import { useSession } from '../../auth/session';
import { t } from '../../i18n';
import { gutter, iconSize, withAlpha } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

/** A round tinted disc holding one glyph (the avatar, the school mark). */
function IconDisc({ name, diameter, glyph }: { name: ComponentProps<typeof Ionicons>['name']; diameter: number; glyph: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: diameter,
        height: diameter,
        borderRadius: diameter / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: withAlpha(colors.accent, 0.14),
      }}
    >
      <Ionicons name={name} size={glyph} color={colors.accent} accessibilityElementsHidden importantForAccessibility="no" />
    </View>
  );
}

/** One contact line: a small glyph, then the value (wraps rather than overflowing). */
function Contact({ name, value }: { name: 'mail-outline' | 'call-outline'; value: string }) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Ionicons name={name} size={iconSize.md} color={colors.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
      <Text variant="bodyLarge" style={{ flex: 1 }}>
        {value}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { colors, spacing, radius } = useTheme();
  const { tenantId } = useSession();
  const me = useMe().data;
  const school = useMySchools().data?.find((candidate) => candidate.tenantId === tenantId);
  const divider = { height: StyleSheet.hairlineWidth, backgroundColor: colors.border };

  return (
    <Screen>
      {/* A brand band the account card overlaps. It bleeds to the screen edges, so it cancels the page gutter. */}
      <View>
        <View
          style={{
            height: 120,
            marginHorizontal: -gutter,
            marginTop: -spacing.lg,
            backgroundColor: colors.brand,
            borderBottomLeftRadius: radius.sheet,
          }}
        />
        {me ? (
          <View style={{ marginTop: -88 }}>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <IconDisc name="person" diameter={72} glyph={36} />
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Text variant="headline">{me.fullName}</Text>
                  {me.email ? <Contact name="mail-outline" value={me.email} /> : null}
                  {me.phone ? <Contact name="call-outline" value={me.phone} /> : null}
                </View>
              </View>
            </Card>
          </View>
        ) : null}
      </View>
      {school ? (
        <Card>
          <Text variant="title">{t('profile.school')}</Text>
          <View style={divider} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <IconDisc name="school-outline" diameter={48} glyph={iconSize.lg} />
            <Text variant="title" style={{ flex: 1 }}>
              {school.name}
            </Text>
          </View>
        </Card>
      ) : null}
      <Card>
        <LanguageSwitch />
      </Card>
      <Card>
        <ThemeSwitch />
      </Card>
      <ShellSwitcher />
      <AccountActions />
    </Screen>
  );
}
