import { render, screen } from '@testing-library/react-native';

import Index from '../app/index';

describe('Index route', () => {
  it('renders the placeholder', async () => {
    await render(<Index />);
    expect(screen.getByText('ZN School')).toBeTruthy();
  });
});
