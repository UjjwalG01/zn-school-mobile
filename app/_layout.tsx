import '../src/bootstrap';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Fragment, useEffect, useState } from 'react';

import { restoreSession } from '../src/auth/session';
import { SessionEvents } from '../src/auth/SessionEvents';
import { ToastHost } from '../src/components/ToastHost';
import { loadStoredLocale, useLocale } from '../src/i18n';
import { QueryProvider } from '../src/providers/QueryProvider';
import { loadStoredTheme } from '../src/theme/themePreference';

// expo-router wraps a route in an error boundary only if it exports one; the root layout's covers
// every screen below it, so a render error shows a retry screen instead of a blank one.
export { ErrorFallback as ErrorBoundary } from '../src/components/ErrorFallback';

export default function RootLayout() {
  // The language and the light/dark choice (Profile) are read before the first screen, so the app never opens in one
  // and flips to another. A missing or unreadable choice keeps the device's.
  const [preferencesReady, setPreferencesReady] = useState(false);
  const locale = useLocale();

  // Cold start: tokens in SecureStore + persisted school/shell → signed in (no network needed).
  useEffect(() => {
    void restoreSession();
    void Promise.all([loadStoredLocale(), loadStoredTheme()]).finally(() => setPreferencesReady(true));
  }, []);

  if (!preferencesReady) return null;

  return (
    <QueryProvider>
      <SessionEvents />
      {/* Strings are read when a screen renders, and some are kept in a memo: a new language re-mounts the screens under
          this key so every one is read again. The cache, the session and the navigation state live above or outside it. */}
      <Fragment key={locale}>
        <Stack screenOptions={{ headerShown: false }} />
      </Fragment>
      <ToastHost />
      {/* Every screen starts with the brand-coloured header (CurvedHeader), in both schemes, so the icons are always light. */}
      <StatusBar style="light" />
    </QueryProvider>
  );
}
