// Downloaded documents (reprint PDFs) are cached here, per tenant, and deleted on logout
// (.claude/rules/security.md §4). The PDF feature (UI_SYSTEM §6) will write under this directory.
import { Directory, Paths } from 'expo-file-system';

export const PDF_CACHE_DIR_NAME = 'pdf-cache';

export const pdfCacheDirectory = (): Directory => new Directory(Paths.cache, PDF_CACHE_DIR_NAME);

export function clearCachedFiles(): void {
  const directory = pdfCacheDirectory();
  if (directory.exists) directory.delete();
}
