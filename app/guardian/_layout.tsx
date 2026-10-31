import { Redirect, Tabs } from 'expo-router';

import { useGuard } from '../../src/auth/guards';
import { brandHeaderOptions } from '../../src/components/BrandHeader';
import { ShellSwitcher } from '../../src/components/ShellSwitcher';
import { t } from '../../src/i18n';

// Guardian tabs (GV-D9; G1 ships Home and Profile, the rest follow in G3 to G6). The Profile screen is the shared one: Switch school,
// Sign out and the shell switcher work the same for every shell.
export default function GuardianLayout() {
  const guard = useGuard('guardian');
  if (guard.kind === 'wait') return null;
  if (guard.kind === 'redirect') return <Redirect href={guard.href} />;
  return (
    <Tabs screenOptions={{ ...brandHeaderOptions, headerRight: () => <ShellSwitcher inverse /> }}>
      <Tabs.Screen name="index" options={{ title: t('shell.home') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile') }} />
    </Tabs>
  );
}
