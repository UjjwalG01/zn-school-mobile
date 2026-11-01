import { render, screen } from '@testing-library/react-native';

import { DataTable, type DataTableColumn } from '../DataTable';
import { Text } from '../Text';

interface Day {
  id: string;
  date: string;
  status: string;
}

const days: Day[] = [
  { id: '1', date: '2026-10-01', status: 'Present' },
  { id: '2', date: '2026-10-02', status: 'Absent' },
];

const columns: DataTableColumn<Day>[] = [
  { key: 'date', title: 'Date', render: (day) => <Text>{day.date}</Text> },
  { key: 'status', title: 'Status', align: 'end', render: (day) => <Text>{day.status}</Text> },
];

describe('DataTable', () => {
  it('shows each column title once, then every row cell', async () => {
    await render(<DataTable columns={columns} rows={days} keyExtractor={(day) => day.id} />);
    expect(screen.getByText('Date')).toBeTruthy();
    expect(screen.getByText('Status')).toBeTruthy();
    expect(screen.getByText('2026-10-01')).toBeTruthy();
    expect(screen.getByText('Absent')).toBeTruthy();
  });

  it('reads a whole row as one label when rowLabel is given', async () => {
    await render(
      <DataTable
        columns={columns}
        rows={days}
        keyExtractor={(day) => day.id}
        rowLabel={(day) => `${day.date}, ${day.status}`}
      />,
    );
    expect(screen.getByLabelText('2026-10-02, Absent')).toBeTruthy();
  });

  it('renders no row for an empty list (the caller shows its empty state)', async () => {
    await render(<DataTable columns={columns} rows={[]} keyExtractor={(day) => day.id} />);
    expect(screen.getByText('Date')).toBeTruthy();
    expect(screen.queryByText('Present')).toBeNull();
  });
});
