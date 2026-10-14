// Runs once at startup (imported by app/_layout.tsx). Fails fast on a bad EXPO_PUBLIC_* config.
import { configureClient } from './api/client';
import { authAdapter } from './auth/authAdapter';
import { env } from './lib/env';

configureClient({ baseUrl: env.apiUrl, auth: authAdapter });
