import { useRouter } from 'expo-router';

import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { t } from '../../src/i18n';

// Placeholder: activation needs B3 (short code + QR), which is Proposed. Nothing is called here.
export default function ActivateScreen() {
  const router = useRouter();
  return (
    <Screen>
      <Text variant="title" accessibilityRole="header">
        {t('activate.title')}
      </Text>
      <Text variant="bodyLarge" tone="muted">
        {t('activate.body')}
      </Text>
      <Button title={t('common.back')} variant="link" onPress={() => router.back()} />
    </Screen>
  );
}
