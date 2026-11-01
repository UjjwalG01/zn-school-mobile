import { configureClient } from '../client';
import { getGuardianAdvance, getGuardianCalendar } from '../portal';

const BASE = 'https://api.test';

function setup(body: unknown) {
  const fetchImpl = jest.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
  configureClient({
    baseUrl: BASE,
    auth: { getAccessToken: () => 'token-1', getTenantId: () => 'tenant-1', refresh: async () => true },
    retryDelaysMs: [],
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return fetchImpl;
}

const requested = (fetchImpl: jest.Mock) => new URL((fetchImpl.mock.calls[0] as unknown as [string])[0]);

describe('guardian calendar request', () => {
  it('GETs the guardian calendar route for the window and maps the items like the staff calendar', async () => {
    const fetchImpl = setup({
      from: '2026-11-01',
      to: '2026-11-30',
      events: [
        {
          kind: 'event',
          id: 'e1',
          title: 'Sports day',
          type: { label: 'Sports', color: 'green' },
          startDate: '2026-11-05',
          endDate: '2026-11-05',
          description: null,
        },
      ],
      holidays: [
        {
          kind: 'holiday',
          id: 'h1',
          name: 'Dashain',
          type: { name: 'Public', color: 'red' },
          startDate: '2026-11-10',
          endDate: '2026-11-12',
          description: null,
        },
      ],
      leave: [],
      weeklyOff: [6],
    });

    const feed = await getGuardianCalendar('2026-11-01', '2026-11-30');
    const url = requested(fetchImpl);
    expect(url.pathname).toBe('/portal/guardian/calendar');
    expect(url.searchParams.get('from')).toBe('2026-11-01');
    expect(url.searchParams.get('to')).toBe('2026-11-30');
    expect(feed.items.map((item) => [item.kind, item.title, item.typeLabel])).toEqual([
      ['holiday', 'Dashain', 'Public'],
      ['event', 'Sports day', 'Sports'],
    ]);
    expect(feed.weeklyOff).toEqual([6]);
  });
});

describe('guardian advance request', () => {
  it('GETs the caller’s own advance route, and keeps an empty answer empty', async () => {
    const fetchImpl = setup([]);
    await expect(getGuardianAdvance()).resolves.toEqual([]);
    expect(requested(fetchImpl).pathname).toBe('/portal/guardian/advance');
  });
});
