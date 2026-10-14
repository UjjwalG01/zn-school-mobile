import { useQueryClient } from '@tanstack/react-query';

import { logout } from './logout';

/** The user-initiated sign out (revokes the refresh token, then wipes everything local). */
export function useSignOut(): () => void {
  const queryClient = useQueryClient();
  return () => void logout(queryClient);
}
