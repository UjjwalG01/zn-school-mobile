import { setShells, useSession } from '../auth/session';
import type { Shell } from '../auth/tenantStore';
import { type MessageKey, t } from '../i18n';
import { Button } from './Button';

export const shellLabelKey = (shell: Shell): MessageKey =>
  shell === 'teacher' ? 'shell.teacher' : 'shell.guardian';

/** Header action for users who hold both shells (ARCHITECTURE §3). Renders nothing otherwise. */
export function ShellSwitcher() {
  const { shell, shells } = useSession();
  const other = shells.find((candidate) => candidate !== shell);
  if (!shell || !other) return null;
  // The shell layouts' guards re-route once the store changes.
  return (
    <Button
      variant="link"
      title={t('shell.switchTo', { shell: t(shellLabelKey(other)) })}
      onPress={() => setShells(shells, other)}
    />
  );
}
