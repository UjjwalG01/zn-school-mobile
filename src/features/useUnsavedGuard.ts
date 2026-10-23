import { useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { Alert } from 'react-native';

import { t } from '../i18n';
import { markUnsaved } from './unsavedWork';

/**
 * Asks before the teacher's own back gesture throws away unsaved edits (attendance, marks). `body` is
 * the screen's own "what will be lost" sentence. Only a back / pop is guarded: sign-out, a school switch
 * or a session ending replace or reset the stack, and must never be blocked by a prompt. Switching tabs
 * does not remove the screen, so the draft survives it. While there are edits it also registers them
 * (`unsavedWork.ts`), so the language switch can warn before it re-mounts the screens.
 */
export function useUnsavedGuard(hasChanges: boolean, body: string): void {
  const navigation = useNavigation();
  useEffect(() => (hasChanges ? markUnsaved() : undefined), [hasChanges]);
  useEffect(() => {
    if (!hasChanges) return;
    return navigation.addListener('beforeRemove', (event) => {
      const type = event.data.action.type;
      if (type !== 'GO_BACK' && type !== 'POP') return;
      event.preventDefault();
      Alert.alert(t('attendance.discardTitle'), body, [
        { text: t('attendance.keepEditing'), style: 'cancel' },
        { text: t('attendance.discard'), style: 'destructive', onPress: () => navigation.dispatch(event.data.action) },
      ]);
    });
  }, [hasChanges, body, navigation]);
}
