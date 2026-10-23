/**
 * RFC 4122 version 4 UUID, for idempotency keys (a dedupe token, not a secret: the backend matches
 * key + body fingerprint inside the school). Prefers the platform CSPRNG; the `Math.random` path
 * only guarantees uniqueness, not unpredictability. Decision D2 (docs/project/ATTENDANCE_PLAN.md):
 * no `expo-crypto` / `uuid` dependency, because `crypto.randomUUID` is not guaranteed on the device.
 */
export function newUuid(): string {
  const c = (globalThis as { crypto?: Partial<Crypto> }).crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();

  const bytes = new Uint8Array(16);
  if (typeof c?.getRandomValues === 'function') {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variant 10

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
