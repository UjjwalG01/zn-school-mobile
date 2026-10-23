import { Stack } from 'expo-router';

import { brandHeaderOptions } from '../../../src/components/BrandHeader';
import { ShellSwitcher } from '../../../src/components/ShellSwitcher';
import { t } from '../../../src/i18n';

// The Attendance tab is a nested stack (class list → roster → a student's details) with its own header, so
// the roster gets a back button. The tab's own header is hidden for it (`stack: true` in the manifest), which is why
// the shell switcher is repeated on the list screen. The roster screen sets its title to the class.
export default function AttendanceLayout() {
  return (
    <Stack screenOptions={brandHeaderOptions}>
      <Stack.Screen name="index" options={{ title: t('attendance.title'), headerRight: () => <ShellSwitcher inverse /> }} />
      <Stack.Screen name="roster" options={{ title: t('attendance.title') }} />
      <Stack.Screen name="student" options={{ title: t('studentInfo.title') }} />
    </Stack>
  );
}
