// Runtime config. Metro only inlines literal `process.env.EXPO_PUBLIC_*` reads, so keep them literal.
// Values are public by definition (bundled into the app) — never put a secret here.

const APP_ENVS = ['development', 'staging', 'production'] as const;
export type AppEnv = (typeof APP_ENVS)[number];

function readAppEnv(): AppEnv {
  const value = process.env.EXPO_PUBLIC_APP_ENV ?? 'development';
  if (!(APP_ENVS as readonly string[]).includes(value)) {
    throw new Error(`EXPO_PUBLIC_APP_ENV must be one of ${APP_ENVS.join(' | ')} (got "${value}")`);
  }
  return value as AppEnv;
}

function readApiUrl(appEnv: AppEnv): string {
  const value = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s/]+/.test(value) || value.includes('YOUR_PC_IP')) {
    throw new Error('EXPO_PUBLIC_API_URL is missing or invalid — set it in .env (see .env.example)');
  }
  if (appEnv !== 'development' && !value.startsWith('https://')) {
    throw new Error('EXPO_PUBLIC_API_URL must be https:// outside development');
  }
  return value;
}

const appEnv = readAppEnv();

export const env = {
  appEnv,
  apiUrl: readApiUrl(appEnv),
} as const;
