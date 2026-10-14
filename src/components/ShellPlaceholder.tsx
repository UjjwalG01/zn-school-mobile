import { View } from 'react-native';

import { useMe, useMySchools } from '../auth/queries';
import { useSession } from '../auth/session';
import type { Shell } from '../auth/tenantStore';
import { useSchoolSwitch } from '../auth/useSchoolSwitch';
import { useSignOut } from '../auth/useSignOut';
import { t } from '../i18n';
import { useTheme } from '../theme/useTheme';
import { Button } from './Button';
import { Screen } from './Screen';
import { shellLabelKey } from './ShellSwitcher';
import { Text } from './Text';

/** Placeholder body of a shell's only tab until feature modules register tabs (M2/M3). */
export function ShellPlaceholder({ shell }: { shell: Shell }) {
  const { spacing } = useTheme();
  const { tenantId } = useSession();
  const me = useMe();
  const schools = useMySchools();
  const { canSwitch, openPicker } = useSchoolSwitch();
  const signOut = useSignOut();
  const school = schools.data?.find((candidate) => candidate.tenantId === tenantId);

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <Text variant="title" accessibilityRole="header">
          {t(shellLabelKey(shell))}
        </Text>
        {school ? <Text variant="bodyLarge">{`${t('shell.school')}: ${school.name}`}</Text> : null}
        {me.data ? (
          <Text tone="muted">{t('shell.signedInAs', { name: me.data.fullName })}</Text>
        ) : null}
      </View>
      <Text variant="bodyLarge" tone="muted">
        {t('shell.placeholder')}
      </Text>
      <View style={{ gap: spacing.sm }}>
        {canSwitch ? (
          <Button title={t('shell.switchSchool')} variant="link" onPress={openPicker} />
        ) : null}
        <Button title={t('common.signOut')} onPress={signOut} />
      </View>
    </Screen>
  );
}
