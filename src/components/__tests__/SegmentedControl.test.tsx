import { render, screen, userEvent } from '@testing-library/react-native';

import { SegmentedControl } from '../SegmentedControl';

const OPTIONS = [
  { value: 'students', label: 'Student Attendance' },
  { value: 'self', label: 'My Attendance' },
] as const;

describe('SegmentedControl', () => {
  it('marks the current option as selected and tells the screen reader the group name', async () => {
    await render(
      <SegmentedControl options={OPTIONS} value="self" onChange={jest.fn()} accessibilityLabel="Attendance sections" />,
    );

    // The group itself is not `accessible` (that would hide its tabs from a screen reader), so find it by label.
    expect(screen.getByLabelText('Attendance sections')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'My Attendance', selected: true })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Student Attendance', selected: false })).toBeTruthy();
  });

  it('reports the pressed option', async () => {
    const onChange = jest.fn();
    await render(
      <SegmentedControl options={OPTIONS} value="students" onChange={onChange} accessibilityLabel="Attendance sections" />,
    );

    await userEvent.setup().press(screen.getByRole('tab', { name: 'My Attendance' }));
    expect(onChange).toHaveBeenCalledWith('self');
  });
});
