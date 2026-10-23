// Hand-written from the backend ENDPOINTS.md §4 (A6). Only fields the app uses.
import type { CalendarPreference } from '../../lib/date';

/** `GET /settings/tenant` — the app reads only `calendarPreference`; timezone, number format and locale are ignored. */
export interface TenantSettings {
  calendarPreference: CalendarPreference;
}

/** One row of `GET /settings/tenant/mobile-modules`. A missing row for a module means visible. */
export interface MobileModuleToggle {
  moduleKey: string;
  visible: boolean;
}
