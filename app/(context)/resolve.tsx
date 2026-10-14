import { Redirect } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { ApiError, errorAction } from '../../src/api/errors';
import { useSessionContext } from '../../src/auth/useSessionContext';
import { useSignOut } from '../../src/auth/useSignOut';
import { Button } from '../../src/components/Button';
import { MessageScreen } from '../../src/components/MessageScreen';
import { t } from '../../src/i18n';
import { useTheme } from '../../src/theme/useTheme';

// The gate after login / cold start: shows a spinner or an error, otherwise redirects to the right
// place (ARCHITECTURE §3).
export default function ResolveScreen() {
  const context = useSessionContext();
  const signOut = useSignOut();
  const { colors } = useTheme();

  switch (context.kind) {
    case 'ready':
      return <Redirect href={context.shell === 'teacher' ? '/teacher' : '/guardian'} />;
    case 'no-school':
      return <Redirect href="/no-school" />;
    case 'choose-school':
      return <Redirect href="/school-picker" />;
    case 'blocked':
      return <Redirect href="/school-unavailable" />;
    case 'web-only':
      return <Redirect href="/use-web" />;
    case 'error': {
      const offline = context.error instanceof ApiError && errorAction(context.error) === 'offline';
      return (
        <MessageScreen
          title={t('context.error.title')}
          body={t(offline ? 'context.error.offline' : 'context.error.generic')}
        >
          <Button title={t('common.retry')} onPress={context.retry} />
          <Button title={t('common.signOut')} variant="link" onPress={signOut} />
        </MessageScreen>
      );
    }
    case 'loading':
      return (
        <MessageScreen title={t('common.loading')}>
          <ActivityIndicator color={colors.accent} accessibilityLabel={t('common.loading')} />
        </MessageScreen>
      );
  }
}
