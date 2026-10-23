import { act, renderHook } from '@testing-library/react-native';

import type { ExamResult } from '../../../../api/types/academic';
import { useMarksDraft } from '../useMarksDraft';

const saved: ExamResult = {
  id: 'r1',
  enrollmentId: 'e1',
  version: 3,
  components: [{ examComponentId: 'c-th', obtainedMarks: '75.00' }],
};

describe('useMarksDraft', () => {
  it('starts empty and remembers the version the teacher first saw, whatever they type next', async () => {
    const { result } = await renderHook(() => useMarksDraft());
    expect(result.current.draft).toEqual({});

    await act(async () => result.current.setValue('e1', saved, 'c-th', '60'));
    await act(async () => result.current.setValue('e1', saved, 'c-pr', '12'));

    expect(result.current.draft.e1).toEqual({ values: { 'c-th': '60', 'c-pr': '12' }, baseVersion: 3 });
  });

  it('uses version 0 for a student with no saved result yet', async () => {
    const { result } = await renderHook(() => useMarksDraft());

    await act(async () => result.current.setValue('e2', undefined, 'c-th', '50'));

    expect(result.current.draft.e2).toEqual({ values: { 'c-th': '50' }, baseVersion: 0 });
  });

  it('drops an edit that goes back to the saved value, so there is no phantom change', async () => {
    const { result } = await renderHook(() => useMarksDraft());

    await act(async () => result.current.setValue('e1', saved, 'c-th', '60'));
    await act(async () => result.current.setValue('e1', saved, 'c-th', '75'));

    expect(result.current.draft).toEqual({});
  });

  it('keep mine rebases one student onto the version now saved, and leaves the others alone', async () => {
    const { result } = await renderHook(() => useMarksDraft());
    await act(async () => result.current.setValue('e1', saved, 'c-th', '60'));
    await act(async () => result.current.setValue('e9', undefined, 'c-th', '40'));

    await act(async () => result.current.keepMine('e1', { ...saved, version: 4 }));

    expect(result.current.draft.e1).toEqual({ values: { 'c-th': '60' }, baseVersion: 4 });
    expect(result.current.draft.e9!.baseVersion).toBe(0);
  });

  it('drop removes the named students (after a save, or "use theirs"); reset clears everything', async () => {
    const { result } = await renderHook(() => useMarksDraft());
    await act(async () => result.current.setValue('e1', saved, 'c-th', '60'));
    await act(async () => result.current.setValue('e2', undefined, 'c-th', '50'));
    await act(async () => result.current.setValue('e3', undefined, 'c-th', '40'));

    await act(async () => result.current.drop(['e1', 'e3']));
    expect(Object.keys(result.current.draft)).toEqual(['e2']);

    await act(async () => result.current.reset());
    expect(result.current.draft).toEqual({});
  });

  it('returns the same callbacks on every render, so a memoized row only re-renders for its own edit', async () => {
    const { result, rerender } = await renderHook(() => useMarksDraft());
    const first = result.current;

    await act(async () => result.current.setValue('e1', saved, 'c-th', '60'));
    await rerender({});

    expect(result.current.setValue).toBe(first.setValue);
    expect(result.current.keepMine).toBe(first.keepMine);
    expect(result.current.drop).toBe(first.drop);
    expect(result.current.reset).toBe(first.reset);
  });
});
