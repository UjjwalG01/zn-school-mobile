import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react-native';

import { emitApiEvent } from '../../api/events';
import { logout } from '../logout';
import { mySchoolsKey } from '../queries';
import { SessionEvents } from '../SessionEvents';
import {
  clearTenant,
  endSession,
  getSession,
  resetSessionForTests,
  selectTenant,
  startSession,
} from '../session';

jest.mock('../logout', () => ({ logout: jest.fn() }));

let client: QueryClient;
let unmount: () => void = () => undefined;

// The event listeners are module-global, so every test unmounts its own SessionEvents; a leftover one
// would handle the next test's events against a stale QueryClient.
async function mount() {
  const view = await render(
    <QueryClientProvider client={client}>
      <SessionEvents />
    </QueryClientProvider>,
  );
  unmount = view.unmount;
}

const emit = <K extends Parameters<typeof emitApiEvent>[0]>(
  event: K,
  payload: Parameters<typeof emitApiEvent<K>>[1],
) =>
  act(async () => {
    emitApiEvent(event, payload);
  });

beforeEach(() => {
  resetSessionForTests();
  client = new QueryClient();
  jest.clearAllMocks();
});

afterEach(() => {
  unmount();
  client.clear();
});

describe('SessionEvents: school access', () => {
  it('a license 403 blocks the school and keeps the backend reason', async () => {
    startSession();
    selectTenant('t1');
    await mount();
    await emit('license-blocked', { errorCode: 'LICENSE_NOT_FOUND', message: 'no license' });
    expect(getSession()).toMatchObject({ blocked: 'license', blockedReason: 'LICENSE_NOT_FOUND' });
  });

  it('a suspended school blocks without a license reason', async () => {
    startSession();
    selectTenant('t1');
    await mount();
    await emit('school-suspended', undefined);
    expect(getSession()).toMatchObject({ blocked: 'suspended', blockedReason: null });
  });

  it('picking or leaving a school clears the block and its reason', async () => {
    startSession();
    selectTenant('t1');
    await mount();
    await emit('license-blocked', { errorCode: 'LICENSE_EXPIRED', message: 'expired' });
    selectTenant('t2'); // the user opens another of their schools from the picker
    expect(getSession()).toMatchObject({ tenantId: 't2', blocked: null, blockedReason: null });

    await emit('license-blocked', { errorCode: 'LICENSE_EXPIRED', message: 'expired' });
    clearTenant();
    expect(getSession()).toMatchObject({ blocked: null, blockedReason: null });
  });

  it('a school the user no longer belongs to is dropped with its cache, other schools stay', async () => {
    startSession();
    selectTenant('t1');
    client.setQueryData(['t1', 'teacher', 'my-classes'], { classes: [] });
    client.setQueryData(['t2', 'teacher', 'my-classes'], { classes: [] });
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    await mount();

    await emit('tenant-access-lost', undefined);

    expect(getSession().tenantId).toBeNull();
    expect(client.getQueryData(['t1', 'teacher', 'my-classes'])).toBeUndefined();
    expect(client.getQueryData(['t2', 'teacher', 'my-classes'])).toBeDefined();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: mySchoolsKey() });
  });

  it('ignores school events while signed out', async () => {
    startSession();
    endSession();
    await mount();
    await emit('license-blocked', { errorCode: 'LICENSE_EXPIRED', message: 'expired' });
    await emit('school-suspended', undefined);
    expect(getSession()).toMatchObject({ status: 'signed-out', blocked: null, blockedReason: null });
  });

  it('an unauthorized event ends the session locally with the expiry notice', async () => {
    startSession();
    selectTenant('t1');
    await mount();
    await emit('unauthorized', undefined);
    expect(logout).toHaveBeenCalledWith(client, { remote: false, notice: 'session-expired' });
  });
});
