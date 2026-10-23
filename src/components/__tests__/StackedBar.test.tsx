import { render, screen } from '@testing-library/react-native';

import { StackedBar } from '../StackedBar';

const segments = [
  { key: 'a', label: 'Submitted', value: 5, color: '#16a34a' },
  { key: 'b', label: 'Returned', value: 0, color: '#d97706' },
  { key: 'c', label: 'Draft', value: 2, color: '#2563eb' },
];

describe('StackedBar', () => {
  it('is read as one element listing every state with its count, zero ones included', async () => {
    await render(<StackedBar segments={segments} />);
    expect(screen.getByLabelText('Submitted: 5, Returned: 0, Draft: 2')).toBeTruthy();
  });

  it('shows every state and its count in the legend', async () => {
    await render(<StackedBar segments={segments} />);
    for (const label of ['Submitted', 'Returned', 'Draft']) expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('draws nothing when every count is zero', async () => {
    await render(<StackedBar segments={segments.map((segment) => ({ ...segment, value: 0 }))} />);
    expect(screen.toJSON()).toBeNull();
  });
});
