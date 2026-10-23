import type { ExpoConfig } from 'expo/config';

const APP_ENVS = ['development', 'staging', 'production'] as const;

const appEnv = process.env.EXPO_PUBLIC_APP_ENV ?? 'development';
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? '';

if (!(APP_ENVS as readonly string[]).includes(appEnv)) {
  throw new Error(`EXPO_PUBLIC_APP_ENV must be one of ${APP_ENVS.join(' | ')} (got "${appEnv}")`);
}

// Release builds must never talk to a plain-HTTP backend (.claude/rules/security.md §7).
// Runtime validation of the same values lives in src/lib/env.ts.
if (appEnv !== 'development' && !apiUrl.startsWith('https://')) {
  throw new Error(`EXPO_PUBLIC_API_URL must be an https:// URL when EXPO_PUBLIC_APP_ENV=${appEnv}`);
}

const config: ExpoConfig = {
  name: 'Orbis',
  slug: 'zn-school-mobile',
  version: '1.0.0',
  scheme: 'znschool',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  runtimeVersion: { policy: 'appVersion' },
  ios: {
    bundleIdentifier: 'com.znschool.mobile',
    supportsTablet: true,
  },
  android: {
    package: 'com.znschool.mobile',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-sharing',
    [
      'expo-camera',
      {
        cameraPermission: 'Allow $(PRODUCT_NAME) to use the camera to scan your activation QR code.',
        recordAudioAndroid: false,
      },
    ],
    [
      'expo-local-authentication',
      { faceIDPermission: 'Allow $(PRODUCT_NAME) to use Face ID to unlock the app.' },
    ],
  ],
  experiments: { typedRoutes: true },
};

export default config;
