import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useScrappers } from '../../../../api/hooks/useScrappers';
import * as endpoints from '../../../../api/endpoints/scrappers';

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useScrappers', () => {
  it('retourne items et état chargement', async () => {
    vi.spyOn(endpoints, 'fetchScrappers').mockResolvedValue([{ id: '1' } as endpoints.Scrapper]);

    const { result } = renderHook(() => useScrappers(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.items).toEqual([{ id: '1' }]);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.refresh).toBe('function');
  });

  it('retourne message d’erreur', async () => {
    vi.spyOn(endpoints, 'fetchScrappers').mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useScrappers(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBe('boom');
  });
});
