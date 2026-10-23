import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { errorActionOf } from '../api/errors';
import { mySchoolsKey } from '../auth/queries';

/**
 * ENTITLEMENT_DENIED means the cached license is out of date (API_CONTRACT §4): refresh my-schools
 * once so the visibility rule drops the feature. Pass the errors of the screen's queries.
 */
export function useRefreshSchoolsOnFeatureDenied(...errors: unknown[]): void {
  const queryClient = useQueryClient();
  const denied = errors.some((error) => errorActionOf(error) === 'feature-denied');
  useEffect(() => {
    if (denied) void queryClient.invalidateQueries({ queryKey: mySchoolsKey() });
  }, [denied, queryClient]);
}
