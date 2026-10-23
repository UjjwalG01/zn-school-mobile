import { View } from 'react-native';

import { useMe, useMySchools } from '../auth/queries';
import { useSession } from '../auth/session';
import type { Shell } from '../auth/tenantStore';
import { t } from '../i18n';
import { useTheme } from '../theme/useTheme';
import { AccountActions } from './AccountActions';
import { Screen } from './Screen';
import { shellLabelKey } from './ShellSwitcher';
import { Text } from './Text';

/** Placeholder body of a shell's only tab until its feature modules land (guardian: M3). */
export function ShellPlaceholder({ shell }: { shell: Shell }) {
  const { spacing } = useTheme();
  const { tenantId } = useSession();
  const me = useMe();
  const schools = useMySchools();
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
      <AccountActions />
    </Screen>
  );
}
