import type { FeatureManifest } from './types';

/**
 * The only list of feature manifests (.claude/rules/mobile-frontend.md §8). Empty until the first
 * feature modules land in M2/M3; do not add tabs or routes outside this registry.
 */
export const featureRegistry: readonly FeatureManifest[] = [];
