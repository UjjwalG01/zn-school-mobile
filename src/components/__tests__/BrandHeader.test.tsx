import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { BrandHeader, brandHeaderOptions } from '../BrandHeader';

describe('BrandHeader', () => {
  it('shows the title as a header, and no back arrow unless asked for', async () => {
    await render(<BrandHeader title="Academic Calendar" />);
    expect(screen.getByRole('header', { name: 'Academic Calendar' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('shows a labelled back arrow that calls onBack, and the action at the end', async () => {
    const onBack = jest.fn();
    await render(<BrandHeader title="Roster" onBack={onBack} right={<Text>Switch</Text>} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Switch')).toBeTruthy();
  });
});

describe('brandHeaderOptions', () => {
  const header = (props: Parameters<typeof brandHeaderOptions.header>[0]) => brandHeaderOptions.header(props);

  it("titles the header from the screen's title option and goes back through the navigator", async () => {
    const goBack = jest.fn();
    await render(
      header({
        options: { title: 'Roster', headerRight: () => <Text>Action</Text> },
        route: { name: 'roster' },
        back: { title: 'Attendance' },
        navigation: { goBack },
      }),
    );
    expect(screen.getByRole('header', { name: 'Roster' })).toBeTruthy();
    expect(screen.getByText('Action')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('has no back arrow on the first screen of a stack, and falls back to the route name without a title', async () => {
    await render(header({ options: {}, route: { name: 'index' }, navigation: { goBack: jest.fn() } }));
    expect(screen.getByRole('header', { name: 'index' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });
});
