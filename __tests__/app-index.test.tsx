import { render } from '@testing-library/react-native';

import Index from '../app/index';
import { endSession, resetSessionForTests, startSession } from '../src/auth/session';

const mockRedirect = jest.fn();
jest.mock('expo-router', () => ({
  Redirect: (props: { href: string }) => {
    mockRedirect(props.href);
    return null;
  },
}));
jest.mock('../src/auth/tokenStore', () => ({ loadTokens: jest.fn() }));
jest.mock('../src/auth/tenantStore', () => ({ loadContext: jest.fn(), saveContext: jest.fn() }));

describe('Index route', () => {
  beforeEach(() => {
    mockRedirect.mockClear();
    resetSessionForTests();
  });

  it('waits while the session is being restored', async () => {
    await render(<Index />);
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('sends a signed-out launch to the login screen', async () => {
    endSession();
    await render(<Index />);
    expect(mockRedirect).toHaveBeenCalledWith('/login');
  });

  it('sends a signed-in launch to the resolve gate', async () => {
    startSession();
    await render(<Index />);
    expect(mockRedirect).toHaveBeenCalledWith('/resolve');
  });
});
