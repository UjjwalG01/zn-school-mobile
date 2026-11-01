// Guardian result detail (G4): one released result with its subject marks. It reads the child's results list (the same cache the
// Results tab filled), so no extra request is made; a result that is no longer released shows the empty message and goes back.
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';

import type { GuardianResult } from '../../api/portal';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DataTable } from '../../components/DataTable';
import { QueryState } from '../../components/QueryState';
import { Screen } from '../../components/Screen';
import { StatusBadge } from '../../components/StatusBadge';
import { Text } from '../../components/Text';
import { t } from '../../i18n';
import { useTheme } from '../../theme/useTheme';
import { documentErrorKey } from './documentModel';
import { useMarksheetDownload } from './useMarksheetDownload';
import { groupBySubject, passTone } from './resultModel';
import { useGuardianResults } from './queries';

const PASS_WORD = {
  pass: 'guardian.results.pass.pass',
  fail: 'guardian.results.pass.fail',
} as const;

/** The figures a marksheet carries: the summary and every subject's marks. Shown on the screen and in the preview. */
function ResultFigures({ result }: { result: GuardianResult }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <Card chevron={false}>
        <Text variant="title">{result.examName}</Text>
        <Text tone="muted">{result.sessionName}</Text>
        <Text>{t('guardian.results.total', { obtained: result.totalObtained, max: result.totalMax })}</Text>
        <Text tone="muted">{t('guardian.results.percentage', { value: result.percentage, grade: result.grade ?? '—' })}</Text>
        <StatusBadge
          label={t(PASS_WORD[result.passStatus as keyof typeof PASS_WORD] ?? 'guardian.results.pass.other')}
          tone={passTone(result.passStatus)}
        />
      </Card>
      {groupBySubject(result.components).map((group) => (
        <Card key={group.subjectName} chevron={false}>
          <Text variant="title">{group.subjectName}</Text>
          <DataTable
            columns={[
              { key: 'component', title: t('table.component'), flex: 2, render: (row) => <Text>{row.componentName}</Text> },
              {
                key: 'obtained',
                title: t('table.obtained'),
                align: 'end',
                render: (row) => <Text>{String(row.obtainedMarks)}</Text>,
              },
              { key: 'max', title: t('table.max'), align: 'end', render: (row) => <Text>{String(row.maxMarks)}</Text> },
            ]}
            rows={group.rows}
            keyExtractor={(row) => `${row.subjectName}-${row.componentName}`}
          />
        </Card>
      ))}
    </View>
  );
}

/**
 * The marksheet is previewed first (owner 2026-10-31): "View marksheet" opens the figures in a modal, and the PDF is requested only
 * when the guardian taps Download inside it. The server decides what the guardian may have; a refusal is shown in words, never guessed.
 */
function MarksheetPreview({ result }: { result: GuardianResult }) {
  const { spacing } = useTheme();
  const [open, setOpen] = useState(false);
  const download = useMarksheetDownload(result.resultId);
  const close = () => setOpen(false);
  return (
    <>
      <Button title={t('documents.preview')} onPress={() => setOpen(true)} />
      <Modal visible={open} animationType="slide" onRequestClose={close}>
        <ScrollView>
          <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, gap: spacing.md }}>
            <Text variant="title">{t('documents.previewTitle')}</Text>
            <ResultFigures result={result} />
            <Button
              title={download.isPending ? t('documents.downloading') : t('documents.download')}
              onPress={() => download.mutate()}
              disabled={download.isPending}
            />
            {download.isError ? <Text tone="error">{t(documentErrorKey(download.error))}</Text> : null}
            <Button title={t('documents.close')} variant="link" onPress={close} />
          </View>
        </ScrollView>
      </Modal>
    </>
  );
}

function ResultBody({ result }: { result: GuardianResult }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <MarksheetPreview result={result} />
      <ResultFigures result={result} />
    </View>
  );
}

export default function GuardianResultDetailScreen() {
  const { studentId, resultId } = useLocalSearchParams<{ studentId: string; resultId: string }>();
  const query = useGuardianResults(studentId ?? null);
  const result = query.data?.find((row) => row.resultId === resultId);
  return (
    <Screen refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <QueryState query={query} isEmpty={!result} emptyText={t('guardian.results.gone')}>
        {result ? <ResultBody result={result} /> : null}
      </QueryState>
    </Screen>
  );
}
