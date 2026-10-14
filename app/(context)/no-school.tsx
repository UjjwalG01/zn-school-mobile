import { useSignOut } from '../../src/auth/useSignOut';
import { Button } from '../../src/components/Button';
import { MessageScreen } from '../../src/components/MessageScreen';
import { t } from '../../src/i18n';

// 0 rows from GET /tenancy/my-schools.
export default function NoSchoolScreen() {
  const signOut = useSignOut();
  return (
    <MessageScreen title={t('noSchool.title')} body={t('noSchool.body')}>
      <Button title={t('common.signOut')} onPress={signOut} />
    </MessageScreen>
  );
}
