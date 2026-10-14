import { Redirect } from 'expo-router';

import { useSession } from '../src/auth/session';

// Entry switchboard: signed out → login; signed in → resolve school + shell (app/(context)/resolve).
export default function Index() {
  const { status } = useSession();
  if (status === 'booting') return null;
  return <Redirect href={status === 'signed-in' ? '/resolve' : '/login'} />;
}
