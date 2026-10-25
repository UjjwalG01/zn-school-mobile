// Profile tab: who is signed in, which school is open, the app's language and light/dark choice, and the two account actions
// (Switch school, Sign out). Always visible, so a school that switches every module off can never lock the user in.
// Both actions are the existing session machinery: `chooseSchool` drops the old school's cache,
// `logout` wipes tokens, context, the persisted cache and downloaded files. The tab header already
// says "Profile", and the license is the administrator's business, so neither is repeated here.
import { View } from 'react-native';

import { AccountActions } from '../../../components/AccountActions';
import { Card } from '../../../components/Card';
import { LanguageSwitch } from '../../../components/LanguageSwitch';
import { Screen } from '../../../components/Screen';
import { ShellSwitcher } from '../../../components/ShellSwitcher';
import { Text } from '../../../components/Text';
import { ThemeSwitch } from '../../../components/ThemeSwitch';
import { useMe, useMySchools } from '../../../auth/queries';
import { useSession } from '../../../auth/session';
import { t } from '../../../i18n';
import { useTheme } from '../../../theme/useTheme';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text variant="bodyLarge">{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { spacing } = useTheme();
  const { tenantId } = useSession();
  const me = useMe().data;
  const school = useMySchools().data?.find((candidate) => candidate.tenantId === tenantId);

  return (
    <Screen>
      <Card>
        <Text variant="caption" tone="muted">
          {t('profile.account')}
        </Text>
        {me ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="title">{me.fullName}</Text>
            {me.email ? <Field label={t('profile.email')} value={me.email} /> : null}
            {me.phone ? <Field label={t('profile.phone')} value={me.phone} /> : null}
          </View>
        ) : null}
      </Card>
      {school ? (
        <Card>
          <Text variant="caption" tone="muted">
            {t('profile.school')}
          </Text>
          <Text variant="title">{school.name}</Text>
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
