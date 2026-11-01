/**
 * A school amount exactly as the server sent it, with the school's currency code in front when one is set. It never rounds,
 * regroups or re-formats the digits (the backend is the only source of money figures; the app does no arithmetic on them).
 */
export function formatMoney(amount: string, currencyCode: string | null): string {
  return currencyCode ? `${currencyCode} ${amount}` : amount;
}
