import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AuthScreen } from '../AuthScreen';

describe('AuthScreen', () => {
  it('shows the app name, the screen title as the header, and the form below', async () => {
    await render(
      <AuthScreen title="Sign in">
        <Text>the form</Text>
      </AuthScreen>,
    );
    expect(screen.getByText('Orbis Education')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Sign in' })).toBeTruthy();
    expect(screen.getByText('the form')).toBeTruthy();
  });
});
