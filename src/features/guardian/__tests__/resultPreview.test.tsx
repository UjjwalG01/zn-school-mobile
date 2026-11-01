import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import * as Sharing from 'expo-sharing';

import { getGuardianMarksheet } from '../../../api/portal';
import { savePdfToCache } from '../../../lib/files';
import GuardianResultDetailScreen from '../ResultDetailScreen';

jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ studentId: 's1', resultId: 'r1' }) }));
jest.mock('../queries', () => ({ useGuardianResults: jest.fn() }));
jest.mock('../../../api/portal', () => ({ getGuardianMarksheet: jest.fn() }));
jest.mock('../../../lib/files', () => ({ savePdfToCache: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>{children}</QueryClientProvider>
);

const mockUseGuardianResults = jest.requireMock('../queries').useGuardianResults as jest.Mock;
const mockMarksheet = getGuardianMarksheet as jest.Mock;
const mockSave = savePdfToCache as jest.Mock;
const mockIsAvailable = Sharing.isAvailableAsync as jest.Mock;
const mockShare = Sharing.shareAsync as jest.Mock;

const RESULT = {
  resultId: 'r1',
  examId: 'e1',
  examName: 'Second Terminal',
  sessionName: '2083',
  academicYearLabel: '2083',
  className: 'Class 8',
  sectionName: 'A',
  status: 'published',
  totalObtained: '70',
  totalMax: '100',
  percentage: '70',
  grade: 'A',
  passStatus: 'pass',
  publishedAt: null,
  components: [
    { subjectName: 'Mathematics', componentName: 'Theory', obtainedMarks: '70', maxMarks: '100', passMarks: '35' },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseGuardianResults.mockReturnValue({ data: [RESULT], error: null, isRefetching: false, refetch: jest.fn() });
  mockMarksheet.mockResolvedValue(new Uint8Array([1, 2, 3]));
  mockSave.mockReturnValue('file:///cache/marksheet-r1.pdf');
  mockIsAvailable.mockResolvedValue(true);
  mockShare.mockResolvedValue(undefined);
});

describe('marksheet preview', () => {
  it('shows nothing and makes no request until View marksheet is tapped', async () => {
    await render(<GuardianResultDetailScreen />, { wrapper });
    expect(screen.queryByText('Marksheet preview')).toBeNull();
    expect(mockMarksheet).not.toHaveBeenCalled();
  });

  it('opens the preview with the subject figures', async () => {
    await render(<GuardianResultDetailScreen />, { wrapper });
    await userEvent.press(screen.getByText('View marksheet'));
    expect(screen.getByText('Marksheet preview')).toBeTruthy();
    expect(screen.getAllByText('Mathematics').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Theory').length).toBeGreaterThan(0);
    expect(screen.getAllByText('70').length).toBeGreaterThan(0);
  });

  it('requests the PDF once, with the result id, only when Download is tapped', async () => {
    await render(<GuardianResultDetailScreen />, { wrapper });
    await userEvent.press(screen.getByText('View marksheet'));
    expect(mockMarksheet).not.toHaveBeenCalled();
    await userEvent.press(screen.getByText('Download marksheet'));
    await waitFor(() => expect(mockShare).toHaveBeenCalled());
    expect(mockMarksheet).toHaveBeenCalledTimes(1);
    expect(mockMarksheet).toHaveBeenCalledWith('r1');
  });

  it('shows the failure text and does not share when sharing is unavailable', async () => {
    mockIsAvailable.mockResolvedValue(false);
    await render(<GuardianResultDetailScreen />, { wrapper });
    await userEvent.press(screen.getByText('View marksheet'));
    await userEvent.press(screen.getByText('Download marksheet'));
    expect(
      await screen.findByText('Could not download the document. Check your connection and try again.'),
    ).toBeTruthy();
    expect(mockShare).not.toHaveBeenCalled();
  });

  it('shares the cached PDF as application/pdf when sharing is available', async () => {
    await render(<GuardianResultDetailScreen />, { wrapper });
    await userEvent.press(screen.getByText('View marksheet'));
    await userEvent.press(screen.getByText('Download marksheet'));
    await waitFor(() => expect(mockShare).toHaveBeenCalledTimes(1));
    expect(mockSave).toHaveBeenCalledWith('marksheet-r1.pdf', expect.any(Uint8Array));
    expect(mockShare).toHaveBeenCalledWith(
      'file:///cache/marksheet-r1.pdf',
      expect.objectContaining({ mimeType: 'application/pdf' }),
    );
  });
});
