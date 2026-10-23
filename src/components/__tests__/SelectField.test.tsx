import { render, screen, userEvent } from '@testing-library/react-native';

import { SelectField } from '../SelectField';

const OPTIONS = [
  { value: 'a', label: 'Class 1' },
  { value: 'b', label: 'Class 2', hint: 'Opens on 2083-07-10' },
];

describe('SelectField', () => {
  it('names the filter and shows what is chosen, or the placeholder', async () => {
    const view = await render(<SelectField label="Class" value="b" options={OPTIONS} onChange={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Class: Class 2' })).toBeTruthy();

    await view.rerender(<SelectField label="Class" value={null} options={OPTIONS} onChange={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Class: Choose' })).toBeTruthy();
  });

  it('opens a list, reports the choice and closes', async () => {
    const onChange = jest.fn();
    await render(<SelectField label="Class" value={null} options={OPTIONS} onChange={onChange} />);
    const user = userEvent.setup();

    expect(screen.queryByRole('radio')).toBeNull();
    await user.press(screen.getByRole('button', { name: /^Class:/ }));
    expect(screen.getByRole('radio', { name: 'Class 1' })).toBeTruthy();
    // A hint is part of the row's spoken name.
    await user.press(screen.getByRole('radio', { name: 'Class 2, Opens on 2083-07-10' }));

    expect(onChange).toHaveBeenCalledWith('b');
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('marks the chosen row as checked', async () => {
    await render(<SelectField label="Class" value="a" options={OPTIONS} onChange={jest.fn()} />);
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: /^Class:/ }));

    expect(screen.getByRole('radio', { name: 'Class 1', checked: true })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /^Class 2/, checked: false })).toBeTruthy();
  });

  it('offers a first row that clears an optional filter', async () => {
    const onChange = jest.fn();
    await render(<SelectField label="Section" value="a" options={OPTIONS} onChange={onChange} clearLabel="All my sections" />);
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: /^Section:/ }));
    await user.press(screen.getByRole('radio', { name: 'All my sections' }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('closes without a choice from the close button', async () => {
    const onChange = jest.fn();
    await render(<SelectField label="Class" value={null} options={OPTIONS} onChange={onChange} />);
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: /^Class:/ }));
    await user.press(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('radio')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('cannot be opened while disabled, and says why', async () => {
    await render(
      <SelectField label="Class" value={null} options={OPTIONS} onChange={jest.fn()} disabled disabledHint="Choose an exam session first" />,
    );
    const user = userEvent.setup();

    expect(screen.getByText('Choose an exam session first')).toBeTruthy();
    await user.press(screen.getByRole('button', { name: /^Class:/ }));
    expect(screen.queryByRole('radio')).toBeNull();
  });
});
