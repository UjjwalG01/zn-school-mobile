// Typed requests for /settings/tenant (docs/api/API_CONTRACT.md; backend ENDPOINTS.md §4).
// Membership-only reads. `tenantId` is attached by the client (selected school).
import { apiGet } from './client';
import type { MobileModuleToggle, TenantSettings } from './types/settings';

/** `GET /settings/tenant` — calendar preference etc.; nulls resolve to platform defaults server-side. */
export const getTenantSettings = () => apiGet<TenantSettings>('/settings/tenant');

/** `GET /settings/tenant/mobile-modules` — per-module mobile visibility (a UX filter only). */
export const getMobileModules = () => apiGet<MobileModuleToggle[]>('/settings/tenant/mobile-modules');
