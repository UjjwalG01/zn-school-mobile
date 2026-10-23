import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { useMySchools } from '../../src/auth/queries';
import { chooseSchool } from '../../src/auth/schoolActions';
import { useSession } from '../../src/auth/session';
import { useSignOut } from '../../src/auth/useSignOut';
import { BrandHeader } from '../../src/components/BrandHeader';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { t } from '../../src/i18n';
import { MIN_TOUCH_TARGET } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/useTheme';

// Several rows in GET /tenancy/my-schools (or a switch). A user belongs to a handful of schools,
// so a plain map is fine here — rosters are the lists that need FlatList.
export default function SchoolPickerScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, spacing, radius } = useTheme();
  const { tenantId } = useSession();
  const schools = useMySchools();
  const signOut = useSignOut();

  function pick(id: string) {
    chooseSchool(queryClient, id);
    router.replace('/resolve');
  }

  return (
    <View style={{ flex: 1 }}>
      <BrandHeader title={t('picker.title')} />
      <Screen>
        <Text variant="bodyLarge" tone="muted">
          {t('picker.body')}
        </Text>

        {schools.data ? (
          <View style={{ gap: spacing.sm }}>
            {schools.data.map((school) => {
              const selected = school.tenantId === tenantId;
              return (
                <Pressable
                  key={school.tenantId}
                  onPress={() => pick(school.tenantId)}
                  accessibilityRole="button"
                  accessibilityLabel={school.name}
                  accessibilityState={{ selected }}
                  style={{
                    minHeight: MIN_TOUCH_TARGET + spacing.md,
                    justifyContent: 'center',
                    paddingVertical: spacing.md,
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? colors.accent : colors.border,
                    borderRadius: radius.xl,
                    backgroundColor: colors.card,
                  }}
                >
                  <Text variant="bodyLarge">{school.name}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <ActivityIndicator color={colors.accent} accessibilityLabel={t('common.loading')} />
        )}

        {router.canGoBack() ? (
          <Button title={t('common.back')} variant="link" onPress={() => router.back()} />
        ) : null}
        <Button title={t('common.signOut')} variant="link" onPress={signOut} />
      </Screen>
    </View>
  );
}
