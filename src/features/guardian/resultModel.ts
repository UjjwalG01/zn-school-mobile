import type { GuardianResultComponent } from '../../api/portal';

/** Pass and fail as the server words them; the badge carries the word, so colour is never the only signal. */
export function passTone(passStatus: string): 'success' | 'danger' | 'neutral' {
  if (passStatus === 'pass') return 'success';
  if (passStatus === 'fail') return 'danger';
  return 'neutral';
}

/** Components grouped by subject, subjects in the order the server listed them. */
export function groupBySubject(components: readonly GuardianResultComponent[]) {
  const groups = new Map<string, GuardianResultComponent[]>();
  for (const component of components) {
    const list = groups.get(component.subjectName) ?? [];
    list.push(component);
    groups.set(component.subjectName, list);
  }
  return [...groups.entries()].map(([subjectName, rows]) => ({ subjectName, rows }));
}
