// The child a guardian is looking at. Held in memory only (GUARDIAN_V1_PLAN §3): never persisted, reset on sign-out and school switch
// (the whole shell unmounts with them). One switcher, shared by every child-scoped tab and screen.
import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';

import type { GuardianStudent } from '../../api/portal';
import { QueryState } from '../../components/QueryState';
import { Screen } from '../../components/Screen';
import { SegmentedControl } from '../../components/SegmentedControl';
import { SelectField } from '../../components/SelectField';
import { Text } from '../../components/Text';
import { t } from '../../i18n';
import { pickSelectedChild } from './childModel';
import { useGuardianStudents } from './queries';

/** At most this many children use the segmented control; more use the dropdown (GV-D10). */
const SEGMENTED_LIMIT = 3;

type StudentsQuery = ReturnType<typeof useGuardianStudents>;

interface ChildContextValue {
  query: StudentsQuery;
  students: GuardianStudent[];
  child: GuardianStudent | null;
  select: (studentId: string) => void;
}

const GuardianChildContext = createContext<ChildContextValue | null>(null);

export function GuardianChildProvider({ children }: { children: ReactNode }) {
  const query = useGuardianStudents();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const students = useMemo(() => query.data ?? [], [query.data]);
  const child = pickSelectedChild(students, selectedId);
  const value = useMemo<ChildContextValue>(
    () => ({ query, students, child, select: setSelectedId }),
    [query, students, child],
  );
  return <GuardianChildContext.Provider value={value}>{children}</GuardianChildContext.Provider>;
}

export function useGuardianChild(): ChildContextValue {
  const value = useContext(GuardianChildContext);
  if (!value) throw new Error('useGuardianChild must be used inside GuardianChildProvider');
  return value;
}

/** Shows the child picker only when there is a choice: none for one child, a segmented control up to three, a dropdown beyond. */
export function ChildSwitcher() {
  const { students, child, select } = useGuardianChild();
  if (students.length <= 1 || !child) return null;
  const options = students.map((student) => ({ value: student.studentId, label: student.fullName }));
  if (students.length <= SEGMENTED_LIMIT) {
    return (
      <SegmentedControl
        options={options}
        value={child.studentId}
        onChange={select}
        accessibilityLabel={t('guardian.child.switcher')}
      />
    );
  }
  return (
    <SelectField
      label={t('guardian.child.switcher')}
      value={child.studentId}
      options={options}
      onChange={(value) => {
        if (value) select(value);
      }}
    />
  );
}

/**
 * A child-scoped screen's frame: the children list's own states (loading, no access, failed, none linked), then the switcher and
 * the body for the selected child. A screen never reads a child id it did not get from this frame.
 */
export function ChildFrame({ children }: { children: (child: GuardianStudent) => ReactNode }) {
  const { query, students, child } = useGuardianChild();
  return (
    <Screen refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <QueryState query={query} isEmpty={students.length === 0} emptyText={t('guardian.home.empty')}>
        {child ? (
          <>
            <ChildSwitcher />
            {children(child)}
          </>
        ) : (
          <Text tone="muted">{t('guardian.home.empty')}</Text>
        )}
      </QueryState>
    </Screen>
  );
}
