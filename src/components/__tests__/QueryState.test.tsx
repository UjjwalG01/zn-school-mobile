import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ApiError, NETWORK_ERROR_CODE } from '../../api/errors';
import { Banner } from '../Banner';
import { Card } from '../Card';
import { QueryState, type QueryStateSource, queryView } from '../QueryState';
import { StatusBadge } from '../StatusBadge';

const source = (overrides: Partial<QueryStateSource> = {}): QueryStateSource => ({
  data: undefined,
  error: null,
  refetch: jest.fn(),
  ...overrides,
});
const failing = (status: number, errorCode?: string) =>
  source({ error: new ApiError(status, 'x', errorCode) });

describe('queryView', () => {
  it('is loading while there is no data and no error', () => {
    expect(queryView(source())).toBe('loading');
  });

  it('shows content, or empty when the caller says so', () => {
    expect(queryView(source({ data: [1] }))).toBe('content');
    expect(queryView(source({ data: [] }), { isEmpty: true })).toBe('empty');
  });

  it('keeps showing cached data when a refetch failed', () => {
    expect(queryView(source({ data: [1], error: new ApiError(0, 'x', NETWORK_ERROR_CODE) }))).toBe('content');
  });

  it('maps errors by action, not message', () => {
    expect(queryView(failing(0, NETWORK_ERROR_CODE))).toBe('offline');
    expect(queryView(failing(500))).toBe('failed');
    expect(queryView(failing(400))).toBe('failed');
    expect(queryView(source({ error: new Error('boom') }))).toBe('failed');
  });

  it('shows "no access" on a plain 403, or hides the section when asked', () => {
    expect(queryView(failing(403))).toBe('noAccess');
    expect(queryView(failing(403), { hideOnForbidden: true })).toBe('hidden');
  });

  it('hides on errors the session layer handles and on a denied entitlement', () => {
    expect(queryView(failing(403, 'ENTITLEMENT_DENIED'))).toBe('hidden');
    expect(queryView(failing(403, 'LICENSE_EXPIRED'))).toBe('hidden');
    expect(queryView(failing(403, 'TENANT_ACCESS_DENIED'))).toBe('hidden');
    expect(queryView(failing(403, 'TENANT_MEMBERSHIP_NOT_FOUND'))).toBe('hidden');
    expect(queryView(failing(401))).toBe('hidden');
  });
});

describe('QueryState', () => {
  it('renders children, the empty text, or the spinner message', async () => {
    const { rerender } = await render(
      <QueryState query={source({ data: [1] })}>
        <Text>content</Text>
      </QueryState>,
    );
    expect(screen.getByText('content')).toBeTruthy();

    await rerender(
      <QueryState query={source({ data: [] })} isEmpty emptyText="Nothing here">
        <Text>content</Text>
      </QueryState>,
    );
    expect(screen.getByText('Nothing here')).toBeTruthy();
    expect(screen.queryByText('content')).toBeNull();

    await rerender(
      <QueryState query={source()}>
        <Text>content</Text>
      </QueryState>,
    );
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('offers a retry after an error and calls refetch once per press', async () => {
    const query = failing(500);
    await render(
      <QueryState query={query}>
        <Text>content</Text>
      </QueryState>,
    );
    expect(screen.getByText('Could not load this section.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(query.refetch).toHaveBeenCalledTimes(1);
  });

  it('says the server is unreachable when offline, with retry', async () => {
    await render(
      <QueryState query={failing(0, NETWORK_ERROR_CODE)}>
        <Text>content</Text>
      </QueryState>,
    );
    expect(screen.getByText(/Could not reach the server/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('shows "no access" without a retry button', async () => {
    await render(
      <QueryState query={failing(403)}>
        <Text>content</Text>
      </QueryState>,
    );
    expect(screen.getByText("You don't have access to this section.")).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders nothing for a hidden section', async () => {
    await render(
      <QueryState query={failing(403)} hideOnForbidden>
        <Text>content</Text>
      </QueryState>,
    );
    expect(screen.toJSON()).toBeNull();
  });
});

describe('Card, StatusBadge and Banner', () => {
  it('Card is a labelled button only when it has a handler', async () => {
    const onPress = jest.fn();
    const { rerender } = await render(
      <Card onPress={onPress} accessibilityLabel="Class 8 · A">
        <Text>body</Text>
      </Card>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Class 8 · A' }));
    expect(onPress).toHaveBeenCalledTimes(1);

    await rerender(
      <Card>
        <Text>body</Text>
      </Card>,
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('body')).toBeTruthy();
  });

  it('StatusBadge always shows its text label', async () => {
    await render(<StatusBadge label="Returned" tone="warning" />);
    expect(screen.getByText('Returned')).toBeTruthy();
  });

  it('Banner announces a warning as an alert, an info note as plain text', async () => {
    const { rerender } = await render(<Banner tone="warning">2 subjects were returned</Banner>);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('2 subjects were returned')).toBeTruthy();

    await rerender(<Banner tone="info">Showing saved data</Banner>);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Showing saved data')).toBeTruthy();
  });
});
