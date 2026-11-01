import { en } from '../../../i18n/en';
import { ne } from '../../../i18n/ne';
import { typeLabelKey } from '../notificationsModel';

describe('finance notification types', () => {
  it('maps invoice and payment notices to their labels', () => {
    expect(typeLabelKey('invoice_issued')).toBe('notifications.type.invoice_issued');
    expect(typeLabelKey('payment_recorded')).toBe('notifications.type.payment_recorded');
  });

  it('falls back to the generic label for an unknown type', () => {
    expect(typeLabelKey('something_new')).toBe('notifications.type.other');
  });

  it('has the labels and the document keys in both English and Nepali', () => {
    const keys = [
      'notifications.type.invoice_issued',
      'notifications.type.payment_recorded',
      'documents.preview',
      'documents.previewTitle',
      'documents.close',
      'documents.download',
    ] as const;
    for (const key of keys) {
      expect(en[key]).toEqual(expect.any(String));
      expect(ne[key]).toEqual(expect.any(String));
    }
  });
});
