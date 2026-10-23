import { useRouter } from 'expo-router';

import { AuthScreen } from '../../src/components/AuthScreen';
import { Button } from '../../src/components/Button';
import { Text } from '../../src/components/Text';
import { t } from '../../src/i18n';

// Placeholder: activation needs B3 (short code + QR), which is Proposed. Nothing is called here.
export default function ActivateScreen() {
  const router = useRouter();
  return (
    <AuthScreen title={t('activate.title')}>
      <Text variant="bodyLarge" tone="muted">
        {t('activate.body')}
      </Text>
      <Button title={t('common.back')} variant="link" onPress={() => router.back()} />
    </AuthScreen>
  );
}
