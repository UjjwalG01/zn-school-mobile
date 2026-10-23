import { render } from '@testing-library/react-native';

import { hasUnsavedWork, markUnsaved } from '../unsavedWork';
import { useUnsavedGuard } from '../useUnsavedGuard';

const mockUnsubscribe = jest.fn();
const mockAddListener = jest.fn(() => mockUnsubscribe);
jest.mock('expo-router', () => ({
  useNavigation: () => ({ addListener: mockAddListener, dispatch: jest.fn() }),
}));

function Screen({ dirty }: { dirty: boolean }) {
  useUnsavedGuard(dirty, 'lost');
  return null;
}

afterEach(() => jest.clearAllMocks());

describe('unsaved work registry', () => {
  it('counts a mark until it is cleared, once each', () => {
    expect(hasUnsavedWork()).toBe(false);
    const first = markUnsaved();
    const second = markUnsaved();
    first();
    first(); // clearing twice is harmless
    expect(hasUnsavedWork()).toBe(true);
    second();
    expect(hasUnsavedWork()).toBe(false);
  });

  it('is set by a screen with edits, follows the edits, and ends when the screen goes away', async () => {
    const view = await render(<Screen dirty={false} />);
    expect(hasUnsavedWork()).toBe(false);

    await view.rerender(<Screen dirty />);
    expect(hasUnsavedWork()).toBe(true);
    expect(mockAddListener).toHaveBeenCalledWith('beforeRemove', expect.any(Function));

    await view.rerender(<Screen dirty={false} />);
    expect(hasUnsavedWork()).toBe(false);
    expect(mockUnsubscribe).toHaveBeenCalled();

    await view.rerender(<Screen dirty />);
    expect(hasUnsavedWork()).toBe(true);
    await view.unmount();
    expect(hasUnsavedWork()).toBe(false);
  });
});
