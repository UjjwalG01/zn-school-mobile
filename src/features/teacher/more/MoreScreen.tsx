// "More": the features that do not have a tab of their own. Every visible `menu` feature that names this tab in
// `tab` is a card (the Academic Calendar today); with none visible, the screen is the one explanatory line.
import { useRouter } from 'expo-router';

import { Card } from '../../../components/Card';
import { Screen } from '../../../components/Screen';
import { Text } from '../../../components/Text';
import { t } from '../../../i18n';
import { menuHref } from '../../routes';
import { useVisibleFeatures } from '../../useVisibleFeatures';
import { teacherMoreFeature } from './manifest';

export default function MoreScreen() {
  const router = useRouter();
  const menu = useVisibleFeatures('teacher').filter((feature) => feature.tab === teacherMoreFeature.id);
  return (
    <Screen>
      {menu.length === 0 ? (
        <Text variant="bodyLarge" tone="muted">
          {t('more.body')}
        </Text>
      ) : (
        menu.map((feature) => (
          <Card key={feature.id} onPress={() => router.push(menuHref(feature))} accessibilityLabel={t(feature.title)}>
            <Text variant="bodyLarge">{t(feature.title)}</Text>
          </Card>
        ))
      )}
    </Screen>
  );
}
