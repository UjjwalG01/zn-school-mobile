// Guardian Fees (G5): one child's fee summary from the server's figures, for the child chosen in the switcher. No invoice rows, no
// payment history, no receipts and no payment action (owner requirement 2026-10-31). Amounts are shown exactly as the server sent them,
// with the school's currency code in front when School Setup has set one. The app does no arithmetic on them. A family-wide total is
// deferred (planned backend route, see the mobile plan §6.1).
import { View } from 'react-native';

import { Card } from '../../components/Card';
import { QueryState } from '../../components/QueryState';
import { StatusBadge } from '../../components/StatusBadge';
import { Text } from '../../components/Text';
import { formatDate } from '../../lib/date';
import { formatMoney } from '../../lib/money';
import { t } from '../../i18n';
import { useTheme } from '../../theme/useTheme';
import { useTenantSettings } from '../queries';
import { ChildFrame } from './GuardianChildContext';
import { type FeeSummary, feeSummary } from './feesModel';
import { useGuardianFees } from './queries';

function Summary({ summary, currencyCode }: { summary: FeeSummary; currencyCode: string | null }) {
  const { spacing } = useTheme();
  const calendar = useTenantSettings().data?.calendarPreference ?? 'gregorian';
  const money = (amount: string) => formatMoney(amount, currencyCode);
  return (
    <View style={{ gap: spacing.md }}>
      <Card chevron={false}>
        <StatusBadge
          label={summary.owes ? t('guardian.fees.owes') : t('guardian.fees.clear')}
          tone={summary.owes ? 'warning' : 'success'}
        />
        <Text variant="title">{money(summary.netOutstanding)}</Text>
        <Text tone="muted">{t('guardian.fees.netOutstanding')}</Text>
      </Card>
      <Card chevron={false}>
        <Text>{`${t('guardian.fees.invoiced')}: ${money(summary.invoiced)}`}</Text>
        <Text>{`${t('guardian.fees.paid')}: ${money(summary.paid)}`}</Text>
        <Text>{`${t('guardian.fees.refunded')}: ${money(summary.refunded)}`}</Text>
        <Text>{`${t('guardian.fees.advance')}: ${money(summary.advance)}`}</Text>
      </Card>
      <Card chevron={false}>
        <Text variant="title">{t('guardian.fees.lastPayment')}</Text>
        {summary.lastPayment ? (
          <Text>{`${formatDate(summary.lastPayment.paymentDate, calendar)} · ${money(summary.lastPayment.amount)}`}</Text>
        ) : (
          <Text tone="muted">{t('guardian.fees.noPayment')}</Text>
        )}
      </Card>
      <Text tone="muted">{t('guardian.fees.note')}</Text>
    </View>
  );
}

function FeesBody({ studentId }: { studentId: string }) {
  const query = useGuardianFees(studentId);
  const currencyCode = useTenantSettings().data?.currencyCode ?? null;
  const data = query.data;
  return (
    <QueryState query={query}>
      {data ? <Summary summary={feeSummary(data)} currencyCode={currencyCode} /> : null}
    </QueryState>
  );
}

export default function GuardianFeesScreen() {
  return <ChildFrame>{(child) => <FeesBody studentId={child.studentId} />}</ChildFrame>;
}
