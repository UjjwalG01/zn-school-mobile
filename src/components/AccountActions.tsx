import { Alert, View } from 'react-native';

import { useSchoolSwitch } from '../auth/useSchoolSwitch';
import { useSignOut } from '../auth/useSignOut';
import { t } from '../i18n';
import { useTheme } from '../theme/useTheme';
import { Button } from './Button';

/**
 * "Switch school" (only with more than one school) and "Sign out", on the account screen. Sign out is a
 * quiet link (as on the school-context screens) and asks first: it wipes the session and the cached data.
 */
export function AccountActions() {
  const { spacing } = useTheme();
  const { canSwitch, openPicker } = useSchoolSwitch();
  const signOut = useSignOut();
  const confirmSignOut = () =>
    Alert.alert(t('shell.signOutTitle'), t('shell.signOutBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.signOut'), style: 'destructive', onPress: signOut },
    ]);
  return (
    <View style={{ gap: spacing.sm }}>
      {canSwitch ? <Button title={t('shell.switchSchool')} variant="link" onPress={openPicker} /> : null}
      <Button title={t('common.signOut')} variant="primary" onPress={confirmSignOut} />
    </View>
  );
}
