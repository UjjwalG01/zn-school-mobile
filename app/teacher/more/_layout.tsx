import { Stack } from 'expo-router';

import { brandHeaderOptions } from '../../../src/components/BrandHeader';
import { ShellSwitcher } from '../../../src/components/ShellSwitcher';
import { t } from '../../../src/i18n';

// The More tab is a nested stack (hub, then its screens) with its own header, so a child screen gets a back button.
// The tab's own header is hidden for it (`stack: true` in the manifest), which is why the shell switcher is repeated on the hub.
export default function MoreLayout() {
  return (
    <Stack screenOptions={brandHeaderOptions}>
      <Stack.Screen name="index" options={{ title: t('tabs.more'), headerRight: () => <ShellSwitcher inverse /> }} />
      <Stack.Screen name="calendar" options={{ title: t('calendar.title') }} />
    </Stack>
  );
}
