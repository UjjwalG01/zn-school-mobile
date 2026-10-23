import { newUuid } from '../uuid';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const realCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
const setCrypto = (value: unknown) =>
  Object.defineProperty(globalThis, 'crypto', { value, configurable: true, writable: true });

afterEach(() => {
  if (realCrypto) Object.defineProperty(globalThis, 'crypto', realCrypto);
  else delete (globalThis as { crypto?: unknown }).crypto;
  jest.restoreAllMocks();
});

describe('newUuid', () => {
  it('uses the platform randomUUID when it exists', () => {
    setCrypto({ randomUUID: () => '11111111-2222-4333-8444-555555555555' });
    expect(newUuid()).toBe('11111111-2222-4333-8444-555555555555');
  });

  it('builds a v4 UUID from getRandomValues when randomUUID is missing', () => {
    setCrypto({
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(0xff);
        return bytes;
      },
    });
    const id = newUuid();
    expect(id).toMatch(V4);
    expect(id).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff'); // version and variant bits forced
  });

  it('still produces a valid v4 UUID with no crypto at all (the Math.random path)', () => {
    setCrypto(undefined);
    expect(newUuid()).toMatch(V4);
  });

  it('forces the version and variant bits even for all-zero input', () => {
    setCrypto({ getRandomValues: (bytes: Uint8Array) => bytes });
    expect(newUuid()).toBe('00000000-0000-4000-8000-000000000000');
  });

  it('is unique across many calls on every path', () => {
    const fakeGetRandomValues = (bytes: Uint8Array) => {
      for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256); // fills in place, as the real one does
      return bytes;
    };
    for (const crypto of [undefined, { getRandomValues: fakeGetRandomValues }]) {
      setCrypto(crypto);
      const ids = new Set(Array.from({ length: 1000 }, () => newUuid()));
      expect(ids.size).toBe(1000);
    }
  });

  it('works with the real Node crypto the tests run on', () => {
    expect(newUuid()).toMatch(V4);
  });
});
