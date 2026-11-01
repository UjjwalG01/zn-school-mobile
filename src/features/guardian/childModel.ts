import type { GuardianStudent } from '../../api/portal';
import { shiftIsoDate, shiftMonth } from '../../lib/date';

/** The children in the order the switcher shows them: the primary guardian's child first, then by name. */
export function orderChildren(students: readonly GuardianStudent[]): GuardianStudent[] {
  return [...students].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return a.fullName.localeCompare(b.fullName);
  });
}

/**
 * The child a screen shows: the remembered one while the account is still linked to them, otherwise the first in the order
 * above. Null when no child is linked. A removed link therefore moves the selection, never shows a stale child.
 */
export function pickSelectedChild(
  students: readonly GuardianStudent[],
  selectedId: string | null,
): GuardianStudent | null {
  const ordered = orderChildren(students);
  return ordered.find((student) => student.studentId === selectedId) ?? ordered[0] ?? null;
}

/** The first and last day of an AD `YYYY-MM` month, as the attendance route takes them. A malformed month comes back unchanged. */
export function monthRange(month: string): { from: string; to: string } {
  const from = `${month}-01`;
  const to = shiftIsoDate(`${shiftMonth(month, 1)}-01`, -1);
  return { from, to };
}
