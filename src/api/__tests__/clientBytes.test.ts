import { configureClient, apiGetBytes } from '../client';
import { ApiError } from '../errors';

const BASE = 'https://api.test';
const PDF = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]); // "%PDF-1.7"

function setup(response: Response) {
  const fetchImpl = jest.fn(async () => response);
  configureClient({
    baseUrl: BASE,
    auth: { getAccessToken: () => 'token-1', getTenantId: () => 'tenant-1', refresh: async () => true },
    retryDelaysMs: [],
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return fetchImpl;
}

describe('apiGetBytes (the one client, binary body)', () => {
  it('returns the PDF bytes, authenticated and tenant-scoped', async () => {
    const fetchImpl = setup(new Response(PDF, { status: 200, headers: { 'Content-Type': 'application/pdf' } }));
    const bytes = await apiGetBytes('/portal/guardian/results/r1/marksheet');
    expect(Array.from(bytes)).toEqual(Array.from(PDF));

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/portal/guardian/results/r1/marksheet');
    expect(url).toContain('tenantId=tenant-1');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-1');
  });

  it('maps a refusal to an ApiError with the server’s code, so the screen can name it', async () => {
    setup(
      new Response(JSON.stringify({ statusCode: 404, errorCode: 'DOCUMENT_NOT_ISSUED', message: 'Not issued' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const error = await apiGetBytes('/portal/guardian/results/r1/marksheet').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, errorCode: 'DOCUMENT_NOT_ISSUED' });
  });
});
