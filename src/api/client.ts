// The ONE HTTP client (.claude/rules/mobile-frontend.md §2). Port of the web `api-client.ts` with
// the mobile behavior of docs/api/API_CONTRACT.md §4–5. Feature code calls typed request functions
// in `src/api/<domain>.ts`; screens never call this file directly.
import {
  ApiError,
  defaultErrorMessage,
  LICENSE_BLOCK_CODES,
  NETWORK_ERROR_CODE,
  NETWORK_ERROR_MESSAGE,
  parseErrorBody,
} from './errors';
import { emitApiEvent } from './events';

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/** What the client needs from the session layer (`src/auth`, M1). Keeps the client free of SecureStore. */
export interface AuthAdapter {
  /** Current access token, or null when signed out. May refresh proactively (< 60 s left). */
  getAccessToken(): Promise<string | null> | string | null;
  /** Selected school; comes only from `GET /tenancy/my-schools`. */
  getTenantId(): string | null;
  /** Exchange the refresh token for a new pair and persist it BEFORE resolving. false = session over. */
  refresh(): Promise<boolean>;
}

export interface ClientConfig {
  baseUrl: string;
  auth?: AuthAdapter;
  /** Per-request timeout. Default 20 s. */
  timeoutMs?: number;
  /** Delays before each GET retry on a network error; its length is the max retries. Default [400, 1200]. */
  retryDelaysMs?: readonly number[];
  /** Test seam. */
  fetchImpl?: typeof fetch;
}

export interface ApiRequestOptions {
  /** Skip the `tenantId` query param — public/identity routes only. */
  skipTenant?: boolean;
  /** No Bearer, no refresh, no `unauthorized` event (login, refresh, activate). */
  public?: boolean;
}

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_RETRY_DELAYS_MS: readonly number[] = [400, 1200];

let config: ClientConfig | null = null;
let refreshInFlight: Promise<boolean> | null = null;

export function configureClient(next: ClientConfig): void {
  config = next;
  refreshInFlight = null;
}

function requireConfig(): ClientConfig {
  if (!config) throw new Error('API client is not configured — call configureClient() at startup');
  return config;
}

/** Single-flight refresh (security.md §2): concurrent callers share one in-flight refresh. */
export function refreshSessionOnce(): Promise<boolean> {
  const { auth } = requireConfig();
  if (!auth) return Promise.resolve(false);
  if (!refreshInFlight) {
    refreshInFlight = auth.refresh().then(
      (ok) => {
        refreshInFlight = null;
        return ok;
      },
      () => {
        refreshInFlight = null;
        return false;
      },
    );
  }
  return refreshInFlight;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const { fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = requireConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch {
    // Offline, DNS failure or timeout — one shape for all of them.
    throw new ApiError(0, NETWORK_ERROR_MESSAGE, NETWORK_ERROR_CODE);
  } finally {
    clearTimeout(timer);
  }
}

/** GET retries on network errors only (max = retryDelaysMs.length); a POST is never retried. */
async function fetchWithRetry(method: Method, url: string, init: RequestInit): Promise<Response> {
  const delays = method === 'GET' ? (requireConfig().retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS) : [];
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fetchWithTimeout(url, init);
    } catch (error) {
      const delay = delays[attempt];
      if (delay === undefined) throw error;
      await sleep(delay);
    }
  }
}

function buildUrl(path: string, options: ApiRequestOptions): string {
  const { baseUrl, auth } = requireConfig();
  const url = new URL(path, `${baseUrl}/`);
  if (!options.skipTenant) {
    const tenantId = auth?.getTenantId() ?? null;
    if (!tenantId) throw new ApiError(400, 'No Tenant ID set');
    url.searchParams.set('tenantId', tenantId);
  }
  return url.toString();
}

async function perform(
  method: Method,
  path: string,
  body: unknown,
  options: ApiRequestOptions,
): Promise<Response> {
  const url = buildUrl(path, options);
  const headers: Record<string, string> = {};
  if (!options.public) {
    const token = await requireConfig().auth?.getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return fetchWithRetry(method, url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function send<T>(
  method: Method,
  path: string,
  body: unknown,
  options: ApiRequestOptions,
): Promise<T> {
  let response = await perform(method, path, body, options);

  if (response.status === 401 && !options.public) {
    // Refresh once (single-flight) and replay once; a second 401 ends the session.
    if (await refreshSessionOnce()) response = await perform(method, path, body, options);
    if (response.status === 401) emitApiEvent('unauthorized', undefined);
  }

  if (!response.ok) {
    const raw = await response.text();
    const { message, errorCode } = parseErrorBody(raw || response.statusText);
    if (errorCode === 'TENANT_MEMBERSHIP_NOT_FOUND') emitApiEvent('tenant-access-lost', undefined);
    if (errorCode && LICENSE_BLOCK_CODES.has(errorCode)) {
      emitApiEvent('license-blocked', { errorCode, message });
    }
    // An HTML proxy page must not surface as a user message.
    const usable = message.length > 0 && message.length <= 300 && !message.startsWith('<');
    throw new ApiError(
      response.status,
      usable ? message : defaultErrorMessage(response.status),
      errorCode,
    );
  }

  // Controllers returning void still answer 200/201 with an empty body, so don't JSON.parse blindly.
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const apiGet = <T>(path: string, options: ApiRequestOptions = {}) =>
  send<T>('GET', path, undefined, options);

/** For a create endpoint include `tenantId` in `body` yourself; the query param is attached anyway. */
export const apiPost = <T>(path: string, body?: unknown, options: ApiRequestOptions = {}) =>
  send<T>('POST', path, body, options);

export const apiPatch = <T>(path: string, body?: unknown, options: ApiRequestOptions = {}) =>
  send<T>('PATCH', path, body, options);

export const apiPut = <T>(path: string, body?: unknown, options: ApiRequestOptions = {}) =>
  send<T>('PUT', path, body, options);

export const apiDelete = <T>(path: string, options: ApiRequestOptions = {}) =>
  send<T>('DELETE', path, undefined, options);

// apiGetBlob (reprint PDFs → expo-file-system, cached per tenant) is added with the first PDF feature.
