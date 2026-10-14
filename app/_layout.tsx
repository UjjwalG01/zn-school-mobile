import '../src/bootstrap';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { QueryProvider } from '../src/providers/QueryProvider';

export default function RootLayout() {
  return (
    <QueryProvider>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </QueryProvider>
  );
}
