import { render, screen } from '@testing-library/react-native';

import { BarChart } from '../BarChart';

const rows = [
  { key: 'a', label: 'Class 8 · A', value: 4 },
  { key: 'b', label: 'Class 6', value: 1 },
];

describe('BarChart', () => {
  it('reads each bar as one element with its label and value', async () => {
    await render(<BarChart rows={rows} color="#2563eb" />);
    expect(screen.getByLabelText('Class 8 · A: 4')).toBeTruthy();
    expect(screen.getByLabelText('Class 6: 1')).toBeTruthy();
  });

  it('shows the label and the value on screen', async () => {
    await render(<BarChart rows={rows} color="#2563eb" />);
    expect(screen.getByText('Class 8 · A')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
  });

  it('draws nothing without rows or when every value is zero', async () => {
    await render(<BarChart rows={[]} color="#2563eb" />);
    expect(screen.toJSON()).toBeNull();
    await render(<BarChart rows={[{ key: 'z', label: 'Class 1', value: 0 }]} color="#2563eb" />);
    expect(screen.toJSON()).toBeNull();
  });
});
