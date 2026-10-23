// Which screens hold edits the person has not saved or discarded right now. Kept apart from `useUnsavedGuard` (which needs the
// router) so a component that only asks, like the language switch, does not pull the router in. Re-reading every string
// re-mounts the screens and drops drafts that live in memory, so the switch asks first when this is not empty.
const unsaved = new Set<symbol>();

/** Marks one screen as holding unsaved work; call the returned function when it no longer does. */
export function markUnsaved(): () => void {
  const mark = Symbol('unsaved');
  unsaved.add(mark);
  return () => {
    unsaved.delete(mark);
  };
}

/** True while any screen holds edits the person has not saved or discarded. */
export const hasUnsavedWork = (): boolean => unsaved.size > 0;
