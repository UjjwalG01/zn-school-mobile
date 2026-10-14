import { Redirect, Stack } from 'expo-router';

import { useGuard } from '../../src/auth/guards';

export default function AuthLayout() {
  const guard = useGuard('auth');
  if (guard.kind === 'wait') return null;
  if (guard.kind === 'redirect') return <Redirect href={guard.href} />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
