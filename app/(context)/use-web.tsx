import { useSchoolSwitch } from '../../src/auth/useSchoolSwitch';
import { useSignOut } from '../../src/auth/useSignOut';
import { Button } from '../../src/components/Button';
import { MessageScreen } from '../../src/components/MessageScreen';
import { t } from '../../src/i18n';

// The user's role in this school has no mobile shell (e.g. accountant only).
export default function UseWebScreen() {
  const signOut = useSignOut();
  const { canSwitch, openPicker } = useSchoolSwitch();
  return (
    <MessageScreen title={t('useWeb.title')} body={t('useWeb.body')}>
      {canSwitch ? <Button title={t('shell.switchSchool')} onPress={openPicker} /> : null}
      <Button
        title={t('common.signOut')}
        variant={canSwitch ? 'link' : 'primary'}
        onPress={signOut}
      />
    </MessageScreen>
  );
}
