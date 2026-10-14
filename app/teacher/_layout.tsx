import { Redirect, Tabs } from 'expo-router';

import { useGuard } from '../../src/auth/guards';
import { ShellSwitcher } from '../../src/components/ShellSwitcher';
import { t } from '../../src/i18n';

// Placeholder tab layout. Real tabs come from the feature registry (FEATURE_MODULES) in M2.
// Path is /teacher (a real segment) so teacher and guardian tab names can never collide.
export default function TeacherLayout() {
  const guard = useGuard('teacher');
  if (guard.kind === 'wait') return null;
  if (guard.kind === 'redirect') return <Redirect href={guard.href} />;
  return (
    <Tabs screenOptions={{ headerRight: () => <ShellSwitcher /> }}>
      <Tabs.Screen name="index" options={{ title: t('shell.home') }} />
    </Tabs>
  );
}
