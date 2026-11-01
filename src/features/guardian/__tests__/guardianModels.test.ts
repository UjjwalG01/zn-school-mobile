import type { GuardianFees, GuardianStudent } from '../../../api/portal';
import { pickSelectedChild, monthRange, orderChildren } from '../childModel';
import { feeSummary } from '../feesModel';
import { groupBySubject, passTone } from '../resultModel';

const child = (studentId: string, fullName: string, isPrimary: boolean): GuardianStudent => ({
  studentId,
  fullName,
  admissionNumber: `STU-${studentId}`,
  status: 'active',
  relationship: 'mother',
  isPrimary,
  classId: null,
  className: null,
  sectionId: null,
  sectionName: null,
});

describe('child selection', () => {
  const two = [child('b', 'Bina', false), child('a', 'Asha', true)];

  it('puts the primary child first, then by name', () => {
    expect(orderChildren([child('c', 'Chirag', false), ...two]).map((s) => s.studentId)).toEqual(['a', 'b', 'c']);
  });

  it('keeps the remembered child while the account is still linked to them', () => {
    expect(pickSelectedChild(two, 'b')?.studentId).toBe('b');
  });

  it('moves to the first child when the remembered one is no longer linked', () => {
    expect(pickSelectedChild(two, 'gone')?.studentId).toBe('a');
  });

  it('defaults to the primary child and is null with no child linked', () => {
    expect(pickSelectedChild(two, null)?.studentId).toBe('a');
    expect(pickSelectedChild([], 'a')).toBeNull();
  });
});

describe('monthRange', () => {
  it('gives the first and last day of the month, including a leap February', () => {
    expect(monthRange('2026-10')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(monthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(monthRange('2027-02')).toEqual({ from: '2027-02-01', to: '2027-02-28' });
  });
});

describe('feeSummary', () => {
  const fees: GuardianFees = {
    position: {
      studentId: 's1',
      receivable: '5000.00',
      advance: '0.00',
      netOutstanding: '3000.00',
      totals: { invoiced: '5000.00', paid: '2000.00', refunded: '0.00', openingBalance: '0.00' },
    },
    payments: { rows: [{ paymentDate: '2026-10-20', amount: '2000.00' }], total: 1 },
  };

  it('shows the server amounts as strings and marks a child who owes', () => {
    const summary = feeSummary(fees);
    expect(summary).toEqual({
      netOutstanding: '3000.00',
      owes: true,
      advance: '0.00',
      invoiced: '5000.00',
      paid: '2000.00',
      refunded: '0.00',
      lastPayment: { paymentDate: '2026-10-20', amount: '2000.00' },
    });
  });

  it('reports nothing due for a zero or credit balance, and no last payment when there is none', () => {
    const settled = feeSummary({ ...fees, position: { ...fees.position, netOutstanding: '0.00' }, payments: { rows: [], total: 0 } });
    expect(settled.owes).toBe(false);
    expect(settled.lastPayment).toBeNull();
    expect(feeSummary({ ...fees, position: { ...fees.position, netOutstanding: '-10.00' } }).owes).toBe(false);
  });

  it('carries no invoice rows or receipt numbers', () => {
    expect(Object.keys(feeSummary(fees)).sort()).toEqual(
      ['advance', 'invoiced', 'lastPayment', 'netOutstanding', 'owes', 'paid', 'refunded'].sort(),
    );
  });
});

describe('results presentation', () => {
  it('groups components by subject in the order the server listed them', () => {
    const groups = groupBySubject([
      { subjectName: 'Maths', componentName: 'Theory', obtainedMarks: '40', maxMarks: '50', passMarks: '20' },
      { subjectName: 'Science', componentName: 'Theory', obtainedMarks: '30', maxMarks: '50', passMarks: '20' },
      { subjectName: 'Maths', componentName: 'Practical', obtainedMarks: '18', maxMarks: '25', passMarks: null },
    ]);
    expect(groups.map((g) => g.subjectName)).toEqual(['Maths', 'Science']);
    expect(groups[0]!.rows.map((r) => r.componentName)).toEqual(['Theory', 'Practical']);
  });

  it('colours pass and fail, and leaves any other word neutral', () => {
    expect(passTone('pass')).toBe('success');
    expect(passTone('fail')).toBe('danger');
    expect(passTone('withheld')).toBe('neutral');
  });
});
