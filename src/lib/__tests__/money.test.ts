import { formatMoney } from '../money';

describe('formatMoney', () => {
  it('prefixes the school currency code when one is set, and keeps the digits exactly as sent', () => {
    expect(formatMoney('3000.00', 'NPR')).toBe('NPR 3000.00');
    expect(formatMoney('1234567.50', 'NPR')).toBe('NPR 1234567.50');
  });

  it('shows the amount alone when no currency is set, never a default code', () => {
    expect(formatMoney('3000.00', null)).toBe('3000.00');
  });
});
