import { useState } from 'react';

/**
 * Pull-to-refresh state. The spinner follows the user's pull only, not background refetches
 * (foreground, mount), so an automatic refetch never shows a spinner. A pull ignores staleTime.
 * `refresh` should refetch the screen's queries (`refetch()` does not reject).
 */
export function useManualRefresh(refresh: () => Promise<unknown>): {
  refreshing: boolean;
  onRefresh: () => void;
} {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = () => {
    setRefreshing(true);
    void refresh().finally(() => setRefreshing(false));
  };
  return { refreshing, onRefresh };
}
