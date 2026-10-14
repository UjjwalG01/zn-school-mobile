import { Redirect, Tabs } from 'expo-router';

import { useGuard } from '../../src/auth/guards';
import { ShellSwitcher } from '../../src/components/ShellSwitcher';
import { t } from '../../src/i18n';

// Placeholder tab layout. Unreachable until backend B4 exposes a guardian role (see
// useSessionContext). Real tabs come from the feature registry in M3.
export default function GuardianLayout() {
  const guard = useGuard('guardian');
  if (guard.kind === 'wait') return null;
  if (guard.kind === 'redirect') return <Redirect href={guard.href} />;
  return (
    <Tabs screenOptions={{ headerRight: () => <ShellSwitcher /> }}>
      <Tabs.Screen name="index" options={{ title: t('shell.home') }} />
    </Tabs>
  );
}
