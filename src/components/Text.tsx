import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme } from '../theme/useTheme';

export interface TextProps extends RNTextProps {
  variant?: 'caption' | 'body' | 'bodyLarge' | 'title' | 'headline';
  tone?: 'default' | 'muted' | 'error' | 'brand';
}

/** Themed text. Scales with the system font size (never set allowFontScaling={false}). */
export function Text({ variant = 'body', tone = 'default', style, ...rest }: TextProps) {
  const { colors, typography } = useTheme();
  const color = {
    default: colors.text,
    muted: colors.textMuted,
    error: colors.destructive,
    brand: colors.accent,
  }[tone];
  return <RNText {...rest} style={[typography[variant], { color }, style]} />;
}
