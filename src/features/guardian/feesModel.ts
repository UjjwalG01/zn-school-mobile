import type { GuardianFees } from '../../api/portal';

/**
 * What the Fees screen shows, read from the server's figures only. Invoice rows and receipt numbers are not part of this model
 * (owner requirement 2026-10-31), so a screen built on it cannot show them.
 */
export interface FeeSummary {
  netOutstanding: string;
  /** True when the child still owes money. A sign test on the server's string; no amount is recomputed here. */
  owes: boolean;
  advance: string;
  invoiced: string;
  paid: string;
  refunded: string;
  lastPayment: { paymentDate: string; amount: string } | null;
}

export function feeSummary(fees: GuardianFees): FeeSummary {
  const { position, payments } = fees;
  const last = payments.rows[0] ?? null;
  return {
    netOutstanding: position.netOutstanding,
    owes: Number(position.netOutstanding) > 0,
    advance: position.advance,
    invoiced: position.totals.invoiced,
    paid: position.totals.paid,
    refunded: position.totals.refunded,
    lastPayment: last ? { paymentDate: last.paymentDate, amount: last.amount } : null,
  };
}
