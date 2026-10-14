// The only place colors, spacing, radius and type live (.claude/rules/mobile-frontend.md §6).
// Light values mirror the web CSS variables in the backend repo `apps/web/src/index.css`
// (docs/frontend/UI_SYSTEM.md §1). The web app has no dark palette, so the dark values below are
// mobile-only; when the web palette changes, update both tables and this file together.

export interface ColorTokens {
  bg: string;
  card: string;
  header: string;
  brand: string;
  text: string;
  textMuted: string;
  textInverse: string;
  accent: string;
  /** Text/icons drawn on an `accent` surface (primary button). */
  onAccent: string;
  border: string;
  destructive: string;
  success: string;
  warning: string;
  warningForeground: string;
}

export const lightColors: ColorTokens = {
  bg: '#f5f6f8', // --color-bg-content
  card: '#ffffff', // --color-bg-card
  header: '#1c2131', // --color-bg-header
  brand: '#1e3a8a', // --color-bg-sidebar
  text: '#282a2e', // --color-text
  textMuted: '#6b7280', // --color-text-muted
  textInverse: '#f5f6f8', // --color-text-inverse
  accent: '#2563eb', // --color-accent
  onAccent: '#ffffff', // mobile-only: contrast on accent (the web uses white button text)
  border: '#e0e0e0', // --color-border
  destructive: '#dc2626', // --color-destructive
  success: '#16a34a', // --color-success
  warning: '#d97706', // --color-warning
  warningForeground: '#1c1200', // --color-warning-foreground
};

export const darkColors: ColorTokens = {
  bg: '#0f1320',
  card: '#181d2e',
  header: '#0b0e17',
  brand: '#3b5bdb',
  text: '#e5e7eb',
  textMuted: '#9ca3af',
  textInverse: '#f5f6f8',
  accent: '#60a5fa',
  onAccent: '#0b0e17',
  border: '#2a3042',
  destructive: '#f87171',
  success: '#4ade80',
  warning: '#fbbf24',
  warningForeground: '#1c1200',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** `--radius` is 0.5rem on the web = 8. */
export const radius = { sm: 4, md: 6, lg: 8, pill: 999 } as const;

export const typography = {
  caption: { fontSize: 12, lineHeight: 16 },
  body: { fontSize: 14, lineHeight: 20 },
  bodyLarge: { fontSize: 16, lineHeight: 22 },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  headline: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
} as const;

/** Minimum touch target in points (accessibility rule). */
export const MIN_TOUCH_TARGET = 44;

/** Opacity of a disabled control (text stays readable; the state is also exposed to screen readers). */
export const DISABLED_OPACITY = 0.5;

export type ColorScheme = 'light' | 'dark';

export const palettes: Record<ColorScheme, ColorTokens> = {
  light: lightColors,
  dark: darkColors,
};
