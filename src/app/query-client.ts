import { QueryClient } from '@tanstack/react-query'

import { friendlyMessage } from '@/lib/db/errors'

/**
 * One client for the whole app. Errors are converted to messages here so no
 * screen has to deal with the raw database response shape.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const kind = typeof error === 'object' && error && 'kind' in error ? error.kind : null
        // Never retry a request that failed because of permissions or auth.
        if (kind === 'forbidden' || kind === 'unauthorized' || kind === 'validation') return false
        return failureCount < 2
      },
    },
    mutations: {
      retry: false,
    },
  },
})

// Surface failures in the console with a readable message; the UI shows the
// same text through <ErrorState>. Typed loosely because the cache event union
// differs between TanStack Query v4 and v5.
const cache = queryClient.getQueryCache() as unknown as {
  subscribe: (listener: (event: unknown) => void) => () => void
}

cache.subscribe((event) => {
  const failure = event as { type?: string; query?: { queryKey: unknown }; error?: unknown }
  if (failure.type !== 'error' || !failure.query) return
  console.error('[pms] query failed', JSON.stringify(failure.query.queryKey), friendlyMessage(failure.error as never))
})