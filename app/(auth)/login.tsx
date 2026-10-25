import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';

import { login } from '../../src/api/identity';
import { classifyIdentifier, loginErrorKey } from '../../src/auth/loginForm';
import { clearNotice, startSession, useSession } from '../../src/auth/session';
import { saveTokens } from '../../src/auth/tokenStore';
import { AuthScreen } from '../../src/components/AuthScreen';
import { Button } from '../../src/components/Button';
import { PasswordField } from '../../src/components/PasswordField';
import { Text } from '../../src/components/Text';
import { TextField } from '../../src/components/TextField';
import { t } from '../../src/i18n';
import { useTheme } from '../../src/theme/useTheme';

export default function LoginScreen() {
  const router = useRouter();
  const { colors, spacing, radius } = useTheme();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [identifierError, setIdentifierError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const { notice } = useSession();

  async function onSubmit() {
    if (inFlight.current) return;

    const kind = classifyIdentifier(identifier);
    const nextIdentifierError =
      kind === 'empty'
        ? t('auth.error.identifierRequired')
        : kind === 'phone'
          ? t('auth.error.phoneSoon') // B2 is Proposed: never call the backend with a phone number
          : kind === 'invalid'
            ? t('auth.error.invalidEmail')
            : null;
    const nextPasswordError = password ? null : t('auth.error.passwordRequired');
    setIdentifierError(nextIdentifierError);
    setPasswordError(nextPasswordError);
    setFormError(null);
    clearNotice();
    if (nextIdentifierError || nextPasswordError) return;

    inFlight.current = true;
    setSubmitting(true);
    try {
      const tokens = await login(identifier.trim(), password);
      try {
        await saveTokens(tokens);
      } catch {
        setFormError(t('auth.error.storage'));
        return;
      }
      setPassword('');
      // Tokens are persisted; resolve me → schools → permissions → shell next (app/(context)/resolve).
      startSession();
      router.replace('/resolve');
    } catch (error) {
      setFormError(t(loginErrorKey(error)));
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <AuthScreen title={t('auth.submit')}>
      <View style={{ gap: spacing.lg }}>
        {notice === 'session-expired' ? (
          <View
            accessibilityRole="alert"
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.md,
              borderWidth: 1,
              borderRadius: radius.lg,
              borderColor: colors.warning,
              backgroundColor: colors.card,
            }}
          >
            <Text>{t('auth.notice.sessionExpired')}</Text>
          </View>
        ) : null}
        {formError ? (
          <View
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.md,
              borderWidth: 1,
              borderRadius: radius.lg,
              borderColor: colors.destructive,
              backgroundColor: colors.card,
            }}
          >
            <Text tone="error">{formError}</Text>
          </View>
        ) : null}

        <TextField
          label={t('auth.identifier.label')}
          value={identifier}
          onChangeText={setIdentifier}
          error={identifierError}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          textContentType="username"
          returnKeyType="next"
          editable={!submitting}
        />
        <PasswordField
          label={t('auth.password.label')}
          value={password}
          onChangeText={setPassword}
          error={passwordError}
          returnKeyType="go"
          onSubmitEditing={() => void onSubmit()}
          editable={!submitting}
        />

        <Button title={t('auth.submit')} onPress={() => void onSubmit()} loading={submitting} />
      </View>

      <Button
        title={t('auth.activate')}
        variant="link"
        onPress={() => router.push('/activate')}
        disabled={submitting}
      />
    </AuthScreen>
  );
}
