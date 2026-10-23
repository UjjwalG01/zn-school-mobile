import { Stack } from 'expo-router';

import { ShellSwitcher } from '../../../src/components/ShellSwitcher';
import { t } from '../../../src/i18n';
import { useHeaderOptions } from '../../../src/theme/useTheme';

// The Academic tab is a nested stack (hub, then its screens) with its own header, so a child screen
// gets a back button. The tab's own header is hidden for it (`stack: true` in the manifest), which is
// why the shell switcher is repeated on the hub.
export default function AcademicLayout() {
  const header = useHeaderOptions();
  return (
    <Stack screenOptions={header}>
      <Stack.Screen name="index" options={{ title: t('tabs.academic'), headerRight: () => <ShellSwitcher /> }} />
      <Stack.Screen name="assignments" options={{ title: t('assignments.title') }} />
      <Stack.Screen name="marks" options={{ title: t('academic.marks') }} />
      <Stack.Screen name="marks-entry" options={{ title: t('academic.marks') }} />
      <Stack.Screen name="exam-attendance" options={{ title: t('examAttendance.title') }} />
      <Stack.Screen name="exam-attendance-sheet" options={{ title: t('examAttendance.title') }} />
    </Stack>
  );
}
