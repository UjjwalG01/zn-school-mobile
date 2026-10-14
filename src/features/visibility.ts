import type { FeatureManifest, VisibilityContext } from './types';

/**
 * Visibility rule of docs/architecture/FEATURE_MODULES.md §3. This is a UX filter only — the
 * backend still enforces permission, license and scope on every call.
 */
export function isFeatureVisible(feature: FeatureManifest, ctx: VisibilityContext): boolean {
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

  return ctx.mobileModules[feature.mobileModuleKey] !== false;
}

/** Visible features, sorted by `order` (stable for equal orders). */
export function visibleFeatures(
  features: readonly FeatureManifest[],
  ctx: VisibilityContext,
): FeatureManifest[] {
  return features.filter((feature) => isFeatureVisible(feature, ctx)).sort((a, b) => a.order - b.order);
}
