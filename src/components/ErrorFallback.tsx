import { useEffect } from 'react';

import { t } from '../i18n';
import { Button } from './Button';
import { MessageScreen } from './MessageScreen';

/** The props expo-router passes to a route's `ErrorBoundary` export (`ErrorBoundaryProps`). */
export interface ErrorFallbackProps {
  error: Error;
  /** Clears the error and renders the route again. */
  retry: () => unknown;
}

/**
 * What the user sees when a screen throws while rendering. Exported as `ErrorBoundary` from the root
 * layout, so it covers every route below it (expo-router wraps a route only if it exports one).
 * The error text is NOT shown: it can hold internal detail. There is no crash reporter yet (open
 * decision A7); development builds log the error so it is not swallowed.
 */
export function ErrorFallback({ error, retry }: ErrorFallbackProps) {
  useEffect(() => {
    if (__DEV__) console.error(error);
  }, [error]);

  return (
    <MessageScreen title={t('error.boundary.title')} body={t('error.boundary.body')}>
      <Button title={t('common.retry')} onPress={() => void retry()} />
    </MessageScreen>
  );
}
