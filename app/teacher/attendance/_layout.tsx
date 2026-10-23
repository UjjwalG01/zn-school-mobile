import { Stack } from 'expo-router';

import { ShellSwitcher } from '../../../src/components/ShellSwitcher';
import { t } from '../../../src/i18n';
import { useHeaderOptions } from '../../../src/theme/useTheme';

// The Attendance tab is a nested stack (class list → roster → a student's details) with its own header, so
// the roster gets a back button. The tab's own header is hidden for it (`stack: true` in the manifest), which is why
// the shell switcher is repeated on the list screen. The roster screen sets its title to the class.
export default function AttendanceLayout() {
  const header = useHeaderOptions();
  return (
    <Stack screenOptions={header}>
      <Stack.Screen name="index" options={{ title: t('attendance.title'), headerRight: () => <ShellSwitcher /> }} />
      <Stack.Screen name="roster" options={{ title: t('attendance.title') }} />
      <Stack.Screen name="student" options={{ title: t('studentInfo.title') }} />
    </Stack>
  );
}
