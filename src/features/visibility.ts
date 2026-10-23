import type { MobileModuleToggle } from '../api/types/settings';
import type { MyPermissions, School } from '../api/types/tenancy';
import type { Audience, FeatureManifest, VisibilityContext } from './types';

export interface VisibilityInputs {
  audience: Audience;
  tenantId: string | null;
  permissions: MyPermissions | undefined;
  schools: readonly School[] | undefined;
  mobileModules: readonly MobileModuleToggle[] | undefined;
}

/**
 * Assembles the rule's input from the cached context queries. Returns null until permissions and the
 * selected school are known (nothing is shown rather than guessed). A missing or failed
 * mobile-modules read means "visible" — it is a UX filter, the backend enforces.
 */
export function buildVisibilityContext(input: VisibilityInputs): VisibilityContext | null {
  const school = input.schools?.find((s) => s.tenantId === input.tenantId);
  if (!input.permissions || !school) return null;
  return {
    audience: input.audience,
    permissions: input.permissions,
    licenseModules: school.license.modules,
    mobileModules: Object.fromEntries((input.mobileModules ?? []).map((m) => [m.moduleKey, m.visible])),
  };
}

/**
 * The four manifest fields the rule reads. A screen that gates a section on a feature which has no
 * manifest yet (Home's Attendance and Marks blocks) passes just these.
 */
export type FeatureAccess = Pick<
  FeatureManifest,
  'audience' | 'requiredPermission' | 'requiredEntitlement' | 'mobileModuleKey'
>;

/**
 * Visibility rule of docs/architecture/FEATURE_MODULES.md §3. This is a UX filter only — the
 * backend still enforces permission, license and scope on every call.
 */
export function isFeatureVisible(feature: FeatureAccess, ctx: VisibilityContext): boolean {
  if (feature.audience !== 'both' && feature.audience !== ctx.audience) return false;

  if (
    feature.requiredPermission !== null &&
    !ctx.permissions.all &&
    !ctx.permissions.keys.includes(feature.requiredPermission)
  ) {
    return false;
  }

  if (
    feature.requiredEntitlement !== null &&
    !ctx.licenseModules.includes(feature.requiredEntitlement)
  ) {
    return false;
  }

  return feature.mobileModuleKey === null || ctx.mobileModules[feature.mobileModuleKey] !== false;
}

/**
 * Tab features to show, sorted by `order`: a tab appears when its own rule holds or a visible `menu`
 * feature names it in `tab` (FEATURE_MODULES §3). A teacher who may only mark their own attendance
 * still gets the Attendance tab.
 */
export function visibleTabs(
  features: readonly FeatureManifest[],
  ctx: VisibilityContext,
): FeatureManifest[] {
  const hosting = new Set(
    features.filter((feature) => feature.tab && isFeatureVisible(feature, ctx)).map((f) => f.tab),
  );
  return features
    .filter(
      (feature) =>
        feature.placement === 'tab' && (isFeatureVisible(feature, ctx) || hosting.has(feature.id)),
    )
    .sort((a, b) => a.order - b.order);
}

/** Visible features, sorted by `order` (stable for equal orders). */
export function visibleFeatures(
  features: readonly FeatureManifest[],
  ctx: VisibilityContext,
): FeatureManifest[] {
  return features.filter((feature) => isFeatureVisible(feature, ctx)).sort((a, b) => a.order - b.order);
}
