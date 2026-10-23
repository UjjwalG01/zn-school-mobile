import type { MessageKey } from '../i18n';
import type { SchoolBlock } from './session';

/** Backend 403 license codes (`LICENSE_BLOCK_CODES`) → the reason shown on "School unavailable". */
const LICENSE_REASONS: Readonly<Record<string, MessageKey>> = {
  LICENSE_NOT_FOUND: 'unavailable.reason.none',
  LICENSE_SUSPENDED: 'unavailable.reason.suspended',
  LICENSE_EXPIRED: 'unavailable.reason.expired',
  LICENSE_NOT_YET_VALID: 'unavailable.reason.scheduled',
};

/** Body of the "School unavailable" screen: the specific license reason when the backend gave one. */
export function unavailableBodyKey(block: SchoolBlock | null, reason: string | null): MessageKey {
  if (block === 'suspended') return 'unavailable.suspended';
  return (reason ? LICENSE_REASONS[reason] : undefined) ?? 'unavailable.license';
}
