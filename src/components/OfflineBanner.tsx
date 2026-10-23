import { errorActionOf } from '../api/errors';
import { useTenantSettings } from '../features/queries';
import { t } from '../i18n';
import { formatTimestamp } from '../lib/date';
import { Banner } from './Banner';

/** The slice of a TanStack `useQuery` result `savedDataTimestamp` reads. */
export interface SavedDataSource {
  data: unknown;
  error: unknown;
  dataUpdatedAt: number;
}

/**
 * When the data on screen is from, if a refresh failed because the device is offline and cached
 * data is being shown instead; null otherwise. With several queries, the oldest one. Other errors
 * keep their own message (ARCHITECTURE §6: "as of" only when offline).
 */
export function savedDataTimestamp(queries: readonly SavedDataSource[]): number | null {
  const stamps = queries
    .filter((query) => query.data !== undefined && errorActionOf(query.error) === 'offline')
    .map((query) => query.dataUpdatedAt);
  return stamps.length > 0 ? Math.min(...stamps) : null;
}

function SavedDataLine({ asOf }: { asOf: number }) {
  // The tenant's calendar decides how the date is written; none is assumed, so wait for the setting.
  const calendar = useTenantSettings().data?.calendarPreference;
  if (!calendar) return null;
  return <Banner tone="info">{t('common.savedData', { when: formatTimestamp(asOf, calendar) })}</Banner>;
}

/**
 * "Showing saved data from 09:42" — the offline "as of" note of ARCHITECTURE §6, built on `Banner`.
 * Pass `savedDataTimestamp([...queries])`; it renders nothing for `null`. The settings read lives in
 * the inner component, so a screen that is online never triggers it.
 */
export function OfflineBanner({ asOf }: { asOf: number | null }) {
  return asOf === null ? null : <SavedDataLine asOf={asOf} />;
}
