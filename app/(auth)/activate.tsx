import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';

import { activate } from '../../src/api/identity';
import { ApiError } from '../../src/api/errors';
import { activateErrorKey, MIN_PASSWORD_LENGTH } from '../../src/auth/activationForm';
import { AuthScreen } from '../../src/components/AuthScreen';
import { Button } from '../../src/components/Button';
import { PasswordField } from '../../src/components/PasswordField';
import { Text } from '../../src/components/Text';
import { TextField } from '../../src/components/TextField';
import { t } from '../../src/i18n';
import { useTheme } from '../../src/theme/useTheme';

/**
 * One form for every activation a school hands out: a guardian code, a staff invitation, an existing account gaining access to
 * another school, and an admin reset. The server says which by asking for the current password (`ACTIVATION_PASSWORD_REQUIRED`).
 * Success goes back to sign-in with the identifier filled in; the code and passwords are never kept after the call.
 */
export default function ActivateScreen() {
  const router = useRouter();
  const { spacing, colors, radius } = useTheme();
  const [code, setCode] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [currentPasswordMode, setCurrentPasswordMode] = useState(false);
  const [errors, setErrors] = useState<Record<'code' | 'identifier' | 'password' | 'confirm', string | null>>({
    code: null,
    identifier: null,
    password: null,
    confirm: null,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);

  function clearPasswords() {
    setPassword('');
    setConfirm('');
  }

  async function onSubmit() {
    if (inFlight.current) return;
    const next = {
      code: code.trim() ? null : t('activate.error.codeRequired'),
      identifier: identifier.trim() ? null : t('activate.error.identifierRequired'),
      password: currentPasswordMode
        ? password
          ? null
          : t('auth.error.passwordRequired')
        : password.length >= MIN_PASSWORD_LENGTH
          ? null
          : t('activate.error.passwordShort'),
      confirm: currentPasswordMode || confirm === password ? null : t('activate.error.passwordMismatch'),
    };
    setErrors(next);
    setFormError(null);
    if (Object.values(next).some(Boolean)) return;

    inFlight.current = true;
    setSubmitting(true);
    try {
      await activate({ code: code.trim(), identifier: identifier.trim(), password });
      setCode('');
      clearPasswords();
      router.replace({ pathname: '/login', params: { identifier: identifier.trim() } });
    } catch (error) {
      setFormError(t(activateErrorKey(error)));
      if (error instanceof ApiError && error.errorCode === 'ACTIVATION_PASSWORD_REQUIRED') {
        setCurrentPasswordMode(true);
        clearPasswords();
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <AuthScreen title={t('activate.title')}>
      <Text variant="bodyLarge" tone="muted">
        {t('activate.hint')}
      </Text>
      <View style={{ gap: spacing.lg }}>
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
          label={t('activate.codeLabel')}
          value={code}
          onChangeText={setCode}
          error={errors.code}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <TextField
          label={t('activate.identifierLabel')}
          value={identifier}
          onChangeText={setIdentifier}
          error={errors.identifier}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="default"
        />
        <PasswordField
          label={currentPasswordMode ? t('activate.currentPasswordLabel') : t('activate.passwordLabel')}
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          returnKeyType={currentPasswordMode ? 'go' : 'next'}
          onSubmitEditing={() => void onSubmit()}
        />
        {currentPasswordMode ? null : (
          <PasswordField
            label={t('activate.confirmLabel')}
            value={confirm}
            onChangeText={setConfirm}
            error={errors.confirm}
            returnKeyType="go"
            onSubmitEditing={() => void onSubmit()}
          />
        )}
        <Button title={t('activate.submit')} onPress={() => void onSubmit()} loading={submitting} />
      </View>

      <Button title={t('common.back')} variant="link" onPress={() => router.back()} disabled={submitting} />
    </AuthScreen>
  );
}
