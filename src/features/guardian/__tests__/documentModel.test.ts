import { ApiError } from '../../../api/errors';
import { documentErrorKey } from '../documentModel';

describe('documentErrorKey', () => {
  it('names a marksheet the school has not issued', () => {
    expect(documentErrorKey(new ApiError(404, 'x', 'DOCUMENT_NOT_ISSUED'))).toBe('documents.notReady');
  });

  it('shows the same unavailable message for another family’s result, an unreleased one and an unknown id', () => {
    expect(documentErrorKey(new ApiError(403, 'x', 'HTTP_FORBIDDEN'))).toBe('documents.unavailable');
  });

  it('says to wait after the download limit', () => {
    expect(documentErrorKey(new ApiError(429, 'x', 'RATE_LIMITED'))).toBe('documents.rateLimited');
  });

  it('falls back to a generic failure for a dropped connection or any other error', () => {
    expect(documentErrorKey(new TypeError('Network request failed'))).toBe('documents.failed');
    expect(documentErrorKey(new ApiError(500, 'x'))).toBe('documents.failed');
  });
});
