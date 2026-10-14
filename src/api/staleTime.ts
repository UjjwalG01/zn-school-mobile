// staleTime classes — .claude/rules/api-and-data.md §5. Changing a class's value is a reviewed
// change, not a per-screen tweak. Screens pick a class, never a number.
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const STALE_TIME = {
  /** classes, sections, subjects, exam list, routine */
  reference: 6 * HOUR,
  /** roster, today's attendance, assignments */
  daily: 5 * MINUTE,
  /** financial position, invoices, payments (wiped on logout) */
  financial: 2 * MINUTE,
  /** published results */
  results: 30 * MINUTE,
  /** /identity/me, my-schools, my-permissions */
  session: 15 * MINUTE,
} as const;

export type StaleClass = keyof typeof STALE_TIME;
