// Guardian Results (G4): released results of the selected child, newest first, as the server returns them. A draft never appears (the
// server lists only `published` and `locked` results). Each row opens the result's subject marks.
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import type { GuardianResult } from '../../api/portal';
import { Card } from '../../components/Card';
import { QueryState } from '../../components/QueryState';
import { StatusBadge } from '../../components/StatusBadge';
import { Text } from '../../components/Text';
import { t } from '../../i18n';
import { useTheme } from '../../theme/useTheme';
import { ChildFrame } from './GuardianChildContext';
import { passTone } from './resultModel';
import { guardianResultHref } from './routes';
import { useGuardianResults } from './queries';

const PASS_WORD = {
  pass: 'guardian.results.pass.pass',
  fail: 'guardian.results.pass.fail',
} as const;

function ResultRow({ result, studentId }: { result: GuardianResult; studentId: string }) {
  const router = useRouter();
  const { spacing } = useTheme();
  return (
    <Card onPress={() => router.push(guardianResultHref(studentId, result.resultId))} accessibilityLabel={result.examName}>
      <Text variant="title">{result.examName}</Text>
      <Text tone="muted">{result.sessionName}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
        <Text>{t('guardian.results.total', { obtained: result.totalObtained, max: result.totalMax })}</Text>
        <StatusBadge
          label={t(PASS_WORD[result.passStatus as keyof typeof PASS_WORD] ?? 'guardian.results.pass.other')}
          tone={passTone(result.passStatus)}
        />
      </View>
      <Text tone="muted">{t('guardian.results.percentage', { value: result.percentage, grade: result.grade ?? '—' })}</Text>
    </Card>
  );
}

function ResultsBody({ studentId }: { studentId: string }) {
  const query = useGuardianResults(studentId);
  const rows = query.data ?? [];
  return (
    <QueryState query={query} isEmpty={rows.length === 0} emptyText={t('guardian.results.empty')}>
      {rows.map((result) => (
        <ResultRow key={result.resultId} result={result} studentId={studentId} />
      ))}
    </QueryState>
  );
}

export default function GuardianResultsScreen() {
  return (
    <ChildFrame>{(child) => <ResultsBody studentId={child.studentId} />}</ChildFrame>
  );
}
