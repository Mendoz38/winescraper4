import { useQuery } from '@tanstack/react-query'
import { fetchScrappers } from '../endpoints/scrappers'
import type { Scrapper } from '../endpoints/scrappers'

export function useScrappers() {
  const query = useQuery<Scrapper[], Error>({
    queryKey: ['scrappers'],
    queryFn: fetchScrappers,
  })

  return {
    items: query.data ?? [],
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refresh: query.refetch,
  }
}
