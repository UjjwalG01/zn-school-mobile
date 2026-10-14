import '../src/bootstrap';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { restoreSession } from '../src/auth/session';
import { SessionEvents } from '../src/auth/SessionEvents';
import { QueryProvider } from '../src/providers/QueryProvider';

export default function RootLayout() {
  // Cold start: tokens in SecureStore + persisted school/shell → signed in (no network needed).
  useEffect(() => {
    void restoreSession();
  }, []);

  return (
    <QueryProvider>
      <SessionEvents />
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </QueryProvider>
  );
}
