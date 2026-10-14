// Runs once at startup (imported by app/_layout.tsx). Fails fast on a bad EXPO_PUBLIC_* config.
// The auth adapter (SecureStore session, refresh) is attached here by the M1 session work.
import { configureClient } from './api/client';
import { env } from './lib/env';

configureClient({ baseUrl: env.apiUrl });
