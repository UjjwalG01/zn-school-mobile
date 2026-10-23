// Features the signed-in user may see in the selected school, for one shell. Reads only cached
// context queries (permissions, schools) plus the mobile-module toggles.
import { useMemo } from 'react';

import { useMyPermissions, useMySchools } from '../auth/queries';
import { useSession } from '../auth/session';
import { useMobileModules } from './queries';
import { featureRegistry } from './registry';
import type { Audience, FeatureManifest, VisibilityContext } from './types';
import { buildVisibilityContext, visibleFeatures } from './visibility';

/** The rule's input, or null until permissions and the selected school are known. */
export function useVisibilityContext(audience: Audience): VisibilityContext | null {
  const { tenantId } = useSession();
  const permissions = useMyPermissions(tenantId).data;
  const schools = useMySchools().data;
  const mobileModules = useMobileModules().data;

  return useMemo(
    () => buildVisibilityContext({ audience, tenantId, permissions, schools, mobileModules }),
    [audience, tenantId, permissions, schools, mobileModules],
  );
}

export function useVisibleFeatures(audience: Audience): FeatureManifest[] {
  const ctx = useVisibilityContext(audience);
  return useMemo(() => (ctx ? visibleFeatures(featureRegistry, ctx) : []), [ctx]);
}
