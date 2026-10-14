// The selected school and shell are NON-secret, so they live in AsyncStorage (API_CONTRACT §5). A
// restart lands on the same screen without extra calls; the context is revalidated in the
// background (ARCHITECTURE §3). `tenantId` stored here originally came from GET /tenancy/my-schools.
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Shell = 'teacher' | 'guardian';

export interface StoredContext {
  tenantId: string | null;
  shell: Shell | null;
}

const KEY = 'zn-context';

const isShell = (value: unknown): value is Shell => value === 'teacher' || value === 'guardian';

export async function loadContext(): Promise<StoredContext> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<StoredContext>) : {};
    return {
      tenantId: typeof parsed.tenantId === 'string' && parsed.tenantId ? parsed.tenantId : null,
      shell: isShell(parsed.shell) ? parsed.shell : null,
    };
  } catch {
    return { tenantId: null, shell: null };
  }
}

export async function saveContext(context: StoredContext): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(context));
  } catch {
    // Non-essential: the context is re-resolved from the API next launch.
  }
}

export async function clearContext(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Nothing else to do — logout continues.
  }
}
