import { render, screen, userEvent } from '@testing-library/react-native';
import type { ComponentProps } from 'react';

import { DateStepper } from '../DateStepper';

async function setup(props: Partial<ComponentProps<typeof DateStepper>> = {}) {
  const onChange = jest.fn();
  const view = await render(
    <DateStepper value="2026-10-21" min="2026-10-14" max="2026-10-21" calendar="gregorian" onChange={onChange} {...props} />,
  );
  return { onChange, view };
}

describe('DateStepper', () => {
  it('steps one day back and, when allowed, forward, passing the canonical AD date', async () => {
    const { onChange } = await setup({ value: '2026-10-18' });
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Previous day' }));
    expect(onChange).toHaveBeenLastCalledWith('2026-10-17');

    await user.press(screen.getByRole('button', { name: 'Next day' }));
    expect(onChange).toHaveBeenLastCalledWith('2026-10-19');
  });

  it('disables the next arrow at the upper bound, and a press does nothing there', async () => {
    const { onChange } = await setup({ value: '2026-10-21' });
    const next = screen.getByRole('button', { name: 'Next day', disabled: true });

    await userEvent.setup().press(next);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('disables the back arrow at the lower bound', async () => {
    await setup({ value: '2026-10-14' });

    expect(screen.getByRole('button', { name: 'Previous day', disabled: true })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next day' })).toBeTruthy();
  });

  it('shows the date in the tenant calendar with the other calendar beside it', async () => {
    const { view } = await setup({ calendar: 'nepali' });
    expect(screen.getByText('2083-07-04')).toBeTruthy(); // BS, the tenant's choice
    expect(screen.getByText('2026-10-21')).toBeTruthy(); // AD, secondary
    await view.unmount();

    await setup({ calendar: 'gregorian' });
    expect(screen.getByText('2026-10-21')).toBeTruthy();
    expect(screen.getByText('2083-07-04')).toBeTruthy();
  });

  it('shows the canonical AD date, and no second line, until the calendar setting is known', async () => {
    await setup({ calendar: undefined });

    expect(screen.getByText('2026-10-21')).toBeTruthy();
    expect(screen.queryByText('2083-07-04')).toBeNull();
  });
});
