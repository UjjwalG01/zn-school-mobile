// Feature manifest — docs/architecture/FEATURE_MODULES.md §2.

export type Audience = 'teacher' | 'guardian';

export interface FeatureManifest {
  /** e.g. `teacher.attendance` */
  id: string;
  /** `'both'` is for shared features (notices, M4). */
  audience: Audience | 'both';
  /** i18n key in practice. */
  title: string;
  icon: string;
  /** Backend permission key, or null. UX hint only (ADR-0038). */
  requiredPermission: string | null;
  /** Backend licensable module, or null. */
  requiredEntitlement: string | null;
  /** Key in `tenant_mobile_module_visibility`. */
  mobileModuleKey: string;
  placement: 'tab' | 'home-card' | 'menu';
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
