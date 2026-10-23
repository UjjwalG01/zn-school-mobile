import {
  dismissToast,
  getToast,
  resetToastForTests,
  showToast,
  subscribeToast,
  TOAST_DURATION_MS,
} from '../toast';

beforeEach(() => {
  resetToastForTests();
});

describe('toast store', () => {
  it('shows a message with a tone (info by default)', () => {
    showToast('Saved');
    expect(getToast()).toMatchObject({ message: 'Saved', tone: 'info' });
    showToast('No connection', 'error');
    expect(getToast()).toMatchObject({ message: 'No connection', tone: 'error' });
  });

  it('keeps one toast at a time: a new one replaces the old and gets a new id', () => {
    showToast('first');
    const first = getToast()!;
    showToast('second');
    expect(getToast()!.message).toBe('second');
    expect(getToast()!.id).not.toBe(first.id);
  });

  it('gives a repeated message a new id so its timer restarts', () => {
    showToast('same');
    const first = getToast()!.id;
    showToast('same');
    expect(getToast()!.id).not.toBe(first);
  });

  it('dismisses, and ignores a stale timer that belongs to a replaced toast', () => {
    showToast('first');
    const staleId = getToast()!.id;
    showToast('second');

    dismissToast(staleId); // the first toast\'s timer firing late
    expect(getToast()!.message).toBe('second');

    dismissToast(getToast()!.id);
    expect(getToast()).toBeNull();
  });

  it('dismisses unconditionally without an id, and is a no-op when nothing is shown', () => {
    showToast('x');
    dismissToast();
    expect(getToast()).toBeNull();
    expect(() => dismissToast()).not.toThrow();
  });

  it('notifies subscribers on show and dismiss, and stops after unsubscribe', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToast(listener);
    showToast('x');
    dismissToast();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    showToast('y');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('does not notify when dismissing nothing', () => {
    const listener = jest.fn();
    subscribeToast(listener);
    dismissToast();
    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps errors on screen longer than other toasts', () => {
    expect(TOAST_DURATION_MS.error).toBeGreaterThan(TOAST_DURATION_MS.info);
    expect(TOAST_DURATION_MS.success).toBe(TOAST_DURATION_MS.info);
  });
});
