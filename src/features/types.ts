// Feature manifest — docs/architecture/FEATURE_MODULES.md §2.
import type { MessageKey } from '../i18n';

export type Audience = 'teacher' | 'guardian';

export interface FeatureManifest {
  /** e.g. `teacher.attendance` */
  id: string;
  /** `'both'` is for shared features (notices, M4). */
  audience: Audience | 'both';
  /** i18n key; the tab label is `t(title)`. */
  title: MessageKey;
  icon: string;
  /** Backend permission key, or null. UX hint only (ADR-0038). */
  requiredPermission: string | null;
  /** Backend licensable module, or null. */
  requiredEntitlement: string | null;
  /** Key in `tenant_mobile_module_visibility`; null = the school cannot switch it off (Profile, More). */
  mobileModuleKey: string | null;
  placement: 'tab' | 'home-card' | 'menu';
  /** For a `menu` feature: the id of the tab feature that lists it (the tab shows while it does). */
  tab?: string;
  /** The route is a nested stack (e.g. class list → roster) that draws its own header: the tab's is hidden. */
  stack?: boolean;
  order: number;
  routes: () => Promise<unknown>;
}

/** Everything the visibility rule needs, resolved from the session/context endpoints. */
export interface VisibilityContext {
  audience: Audience;
  /** `GET /tenancy/my-permissions` → `{ all, keys }`. */
  permissions: { all: boolean; keys: readonly string[] };
  /** `GET /tenancy/my-schools` → selected school's `license.modules`. */
  licenseModules: readonly string[];
  /** `GET /settings/tenant/mobile-modules` → `{ moduleKey: visible }`; a missing key means visible. */
  mobileModules: Readonly<Record<string, boolean>>;
}
