import { fireEvent, render, screen } from '@testing-library/react-native';

import { ErrorFallback } from '../ErrorFallback';

describe('ErrorFallback', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('shows a plain message and a retry button, never the error text', async () => {
    await render(<ErrorFallback error={new Error('db password=hunter2 leaked')} retry={jest.fn()} />);

    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText(/ran into an unexpected problem/)).toBeTruthy();
    expect(screen.queryByText(/hunter2/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('retries the route when the button is pressed', async () => {
    const retry = jest.fn();
    await render(<ErrorFallback error={new Error('boom')} retry={retry} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('logs the error in development builds so it is not swallowed', async () => {
    const error = new Error('boom');
    await render(<ErrorFallback error={error} retry={jest.fn()} />);

    expect(consoleError).toHaveBeenCalledWith(error);
  });
});
