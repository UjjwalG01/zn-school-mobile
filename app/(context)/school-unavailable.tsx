import { useRouter } from 'expo-router';

import { unavailableBodyKey } from '../../src/auth/schoolBlock';
import { useSession, setBlocked } from '../../src/auth/session';
import { useSchoolSwitch } from '../../src/auth/useSchoolSwitch';
import { useSignOut } from '../../src/auth/useSignOut';
import { Button } from '../../src/components/Button';
import { MessageScreen } from '../../src/components/MessageScreen';
import { t } from '../../src/i18n';

// TENANT_ACCESS_DENIED / LICENSE_* for the selected school. Login itself still works.
export default function SchoolUnavailableScreen() {
  const router = useRouter();
  const { blocked, blockedReason } = useSession();
  const signOut = useSignOut();
  const { canSwitch, openPicker } = useSchoolSwitch();

  return (
    <MessageScreen
      title={t('unavailable.title')}
      body={t(unavailableBodyKey(blocked, blockedReason))}
    >
      <Button
        title={t('common.retry')}
        onPress={() => {
          setBlocked(null); // re-resolve; a still-blocked school will block again
          router.replace('/resolve');
        }}
      />
      {canSwitch ? (
        <Button title={t('shell.switchSchool')} variant="link" onPress={openPicker} />
      ) : null}
      <Button title={t('common.signOut')} variant="link" onPress={signOut} />
    </MessageScreen>
  );
}
