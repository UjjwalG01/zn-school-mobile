import { Redirect, Stack } from 'expo-router';

import { useGuard } from '../../src/auth/guards';

// Signed-in screens that are not a shell: resolve gate, school picker, "no school", "use the web
// app", "school unavailable".
export default function ContextLayout() {
  const guard = useGuard('signed-in');
  if (guard.kind === 'wait') return null;
  if (guard.kind === 'redirect') return <Redirect href={guard.href} />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
