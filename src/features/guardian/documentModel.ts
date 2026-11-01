// What a failed document download means to the guardian. The server decides every refusal; the app only names it.
import { ApiError } from '../../api/errors';
import type { MessageKey } from '../../i18n';

export function documentErrorKey(error: unknown): MessageKey {
  if (error instanceof ApiError) {
    // Not issued yet: the school has not produced the marksheet (a released result without an issued copy).
    if (error.status === 404 && error.errorCode === 'DOCUMENT_NOT_ISSUED') return 'documents.notReady';
    if (error.status === 429) return 'documents.rateLimited';
    // Another family's result, a result not yet released and an unknown id look the same to the guardian (ADR-0081 D2).
    if (error.status === 403) return 'documents.unavailable';
  }
  return 'documents.failed';
}
