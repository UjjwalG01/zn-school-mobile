import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { dismissToast, resetToastForTests, showToast, TOAST_DURATION_MS } from '../../lib/toast';
import { ToastHost } from '../ToastHost';

/** The slide-out duration in ToastHost (not exported; the tests wait it out). */
const HIDE_MS = 220;

beforeEach(() => {
  jest.useFakeTimers();
  resetToastForTests();
  jest.mocked(AccessibilityInfo.announceForAccessibility).mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('ToastHost', () => {
  it('renders nothing until a toast is shown', async () => {
    await render(<ToastHost />);
    expect(screen.queryByText('Saved')).toBeNull();
  });

  it('shows a toast from anywhere in the app and announces it to screen readers', async () => {
    await render(<ToastHost />);
    await act(async () => {
      showToast('Attendance saved', 'success');
    });

    expect(screen.getByText('Attendance saved')).toBeTruthy();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Attendance saved');
  });

  it('marks an error toast as an alert', async () => {
    await render(<ToastHost />);
    await act(async () => {
      showToast('Could not save', 'error');
    });

    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('hides itself after its duration', async () => {
    await render(<ToastHost />);
    await act(async () => {
      showToast('Saved');
    });

    await act(async () => {
      jest.advanceTimersByTime(TOAST_DURATION_MS.info - 1);
    });
    expect(screen.getByText('Saved')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    // It slides out first: still mounted until the exit animation finishes.
    expect(screen.getByText('Saved')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(HIDE_MS);
    });
    expect(screen.queryByText('Saved')).toBeNull();
  });

  it('restarts the timer when a new toast replaces the old one', async () => {
    await render(<ToastHost />);
    await act(async () => {
      showToast('first');
    });
    await act(async () => {
      jest.advanceTimersByTime(TOAST_DURATION_MS.info - 1000);
    });
    await act(async () => {
      showToast('second');
    });
    await act(async () => {
      jest.advanceTimersByTime(TOAST_DURATION_MS.info - 1000); // past the first toast's original deadline
    });

    expect(screen.queryByText('first')).toBeNull();
    expect(screen.getByText('second')).toBeTruthy();
  });

  it('dismisses on tap', async () => {
    await render(<ToastHost />);
    await act(async () => {
      showToast('Tap me');
    });

    await fireEvent.press(screen.getByText('Tap me'));
    await act(async () => {
      jest.advanceTimersByTime(HIDE_MS);
    });
    expect(screen.queryByText('Tap me')).toBeNull();
  });

  it('clears when dismissed from code', async () => {
    await render(<ToastHost />);
    await act(async () => {
      showToast('Gone soon');
    });
    await act(async () => {
      dismissToast();
    });
    await act(async () => {
      jest.advanceTimersByTime(HIDE_MS);
    });
    expect(screen.queryByText('Gone soon')).toBeNull();
  });
});
