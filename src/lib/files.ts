// Downloaded documents (reprint PDFs) are cached here, per tenant, and deleted on logout
// (.claude/rules/security.md §4). The PDF feature (UI_SYSTEM §6) will write under this directory.
import { Directory, File, Paths } from 'expo-file-system';

export const PDF_CACHE_DIR_NAME = 'pdf-cache';

export const pdfCacheDirectory = (): Directory => new Directory(Paths.cache, PDF_CACHE_DIR_NAME);

export function clearCachedFiles(): void {
  const directory = pdfCacheDirectory();
  if (directory.exists) directory.delete();
}

/**
 * Writes one downloaded PDF into the cache and returns its file URI. The name is chosen by the caller from ids the server
 * sent (never from user text). A file with the same name is replaced, so a second download is the same document.
 */
export function savePdfToCache(fileName: string, bytes: Uint8Array): string {
  const directory = pdfCacheDirectory();
  directory.create({ intermediates: true, idempotent: true });
  const file = new File(directory, fileName);
  file.create({ overwrite: true });
  file.write(bytes);
  return file.uri;
}
