// Downloads one marksheet: fetch the bytes through the one API client, keep them in the PDF cache (cleared on sign-out), then open the
// phone's share sheet so the guardian can save or print it. Nothing is generated here; the server issued the document.
import { useMutation } from '@tanstack/react-query';
import * as Sharing from 'expo-sharing';

import { getGuardianMarksheet } from '../../api/portal';
import { t } from '../../i18n';
import { savePdfToCache } from '../../lib/files';

export function useMarksheetDownload(resultId: string) {
  return useMutation({
    mutationFn: async () => {
      const bytes = await getGuardianMarksheet(resultId);
      const uri = savePdfToCache(`marksheet-${resultId}.pdf`, bytes);
      // No share sheet on this device is a failure the guardian must see, not a silent no-op (the file stays in the cache).
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: t('documents.shareTitle'),
      });
    },
  });
}
