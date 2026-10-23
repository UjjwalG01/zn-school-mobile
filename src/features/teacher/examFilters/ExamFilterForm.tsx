// The filters of an exam workflow, drawn the way the web's filter row is: Exam session, Class, Section (when there is
// one to choose), and the subject or paper, then one button that opens the work screen. The screen that owns the workflow
// supplies the exams (already limited by the server to this teacher) and says what the button does.
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { SelectField } from '../../../components/SelectField';
import { t } from '../../../i18n';
import { useTheme } from '../../../theme/useTheme';
import { choose, EMPTY_SELECTION, type PickExam, type PickItem, resolve, type Selection } from './examFilterModel';

export interface ExamFilterFormProps {
  exams: readonly PickExam[];
  /** "Subject" for marks, "Paper" for exam attendance. */
  itemLabel: string;
  /** The button's text. */
  openLabel: string;
  /** Called with the chosen exam, item and (optional) section when the teacher presses the button. */
  onOpen: (target: { exam: PickExam; item: PickItem; sectionId: string | null; sectionName: string | null }) => void;
}

export function ExamFilterForm({ exams, itemLabel, openLabel, onOpen }: ExamFilterFormProps) {
  const { spacing } = useTheme();
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION);
  const view = useMemo(() => resolve(exams, selection), [exams, selection]);
  const set = (level: keyof Selection) => (value: string | null) => setSelection((previous) => choose(previous, level, value));

  const wholeClass = view.exam !== null && view.exam.sectionId === null;
  // A section can be chosen when the class is one exam for all sections (optional) or has an exam per section (required).
  const showSection = view.sectionRequired || (wholeClass && view.sectionOptions.length > 0);
  const chosenSection = view.sectionOptions.find((entry) => entry.id === view.sectionId);

  return (
    <View style={{ gap: spacing.md }}>
      <SelectField
        label={t('filter.session')}
        value={view.session}
        options={view.sessions.map((name) => ({ value: name, label: name }))}
        onChange={set('session')}
      />
      <SelectField
        label={t('filter.class')}
        value={view.classId}
        options={view.classes.map((entry) => ({ value: entry.id, label: entry.name }))}
        onChange={set('classId')}
        disabled={view.session === null}
        disabledHint={t('filter.pickSessionFirst')}
      />
      {showSection ? (
        <SelectField
          label={view.sectionRequired ? t('filter.section') : t('filter.sectionOptional')}
          value={view.sectionId}
          options={view.sectionOptions.map((entry) => ({ value: entry.id, label: entry.name }))}
          onChange={set('sectionId')}
          clearLabel={view.sectionRequired ? undefined : t('filter.allSections')}
        />
      ) : null}
      {view.sectionRequired ? <Banner tone="info">{t('filter.sectionNeeded')}</Banner> : null}
      <SelectField
        label={itemLabel}
        value={view.item?.key ?? null}
        options={view.items.map((entry) => ({ value: entry.key, label: entry.label, hint: entry.hint }))}
        onChange={set('itemKey')}
        disabled={view.exam === null}
        disabledHint={view.classId === null ? t('filter.pickClassFirst') : t('filter.pickExamFirst')}
      />
      <Button
        title={openLabel}
        disabled={view.exam === null || view.item === null || view.item.blocked}
        onPress={() => {
          if (view.exam && view.item) {
            onOpen({ exam: view.exam, item: view.item, sectionId: view.sectionId, sectionName: chosenSection?.name ?? null });
          }
        }}
      />
      {view.item?.blocked && view.item.hint ? <Banner tone="info">{view.item.hint}</Banner> : null}
      {view.item?.note ? <Banner tone="warning">{view.item.note}</Banner> : null}
    </View>
  );
}
