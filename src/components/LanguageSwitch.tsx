import { Alert, View } from 'react-native';

import { hasUnsavedWork } from '../features/unsavedWork';
import { chooseLocale, type Locale, LOCALES, t, useLocale } from '../i18n';
import { useTheme } from '../theme/useTheme';
import { SegmentedControl } from './SegmentedControl';
import { Text } from './Text';

/**
 * The app's language, one tap each (Profile). Reading every string again re-mounts the screens, which drops edits that
 * are only in memory, so when any screen holds unsaved work the person is asked first. The choice is remembered on the
 * device and is not part of the account or the school.
 */
export function LanguageSwitch() {
  const { spacing } = useTheme();
  const locale = useLocale();

  const change = (next: Locale) => {
    if (next === locale) return;
    if (!hasUnsavedWork()) {
      void chooseLocale(next);
      return;
    }
    Alert.alert(t('language.confirmTitle'), t('language.confirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('language.confirm'), style: 'destructive', onPress: () => void chooseLocale(next) },
    ]);
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="caption" tone="muted">
        {t('language.title')}
      </Text>
      <SegmentedControl
        options={LOCALES}
        value={locale}
        onChange={change}
        accessibilityLabel={t('language.title')}
      />
    </View>
  );
}
