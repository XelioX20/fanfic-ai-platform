'use client'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { useState, useEffect, useRef } from 'react'
import { useUIStore } from '@/store'
import { ReadingStateHydrator } from '@/components/ReadingStateHydrator'
import { idbStorage } from '@/lib/idb-storage'

function ThemeInitializer() {
  const theme = useUIStore(s => s.theme)
  const themeUserSet = useUIStore(s => s.themeUserSet)

  // On first mount, if user never touched the theme picker and the device is mobile-width,
  // default to the light theme (looks better outdoors / on daylight).
  useEffect(() => {
    if (!themeUserSet && typeof window !== 'undefined' && window.matchMedia) {
      const isMobile = window.matchMedia('(max-width: 640px)').matches
      if (isMobile && theme !== 'light') {
        // Directly mutate DOM — don't persist as "user set" so it flips back on desktop
        document.documentElement.className = 'light'
        return
      }
    }
    document.documentElement.className = theme
  }, [theme, themeUserSet])
  return null
}

// Cache-persistence policy:
// - gcTime: 7 days for anything persistable (fic details, chapters, rails).
//   React Query only writes queries older than staleTime AND still within
//   gcTime to the persistent store — 7 days means a fic re-opened next
//   week still renders instantly from device cache.
// - Persisted cache is keyed by our build hash so a schema change doesn't
//   accidentally render stale data with a new UI expecting new fields.
//
// Bump BUSTER whenever the shape of a persisted query result changes
// (e.g. added required field, renamed key) so old device caches are
// nuked instead of hydrating into a UI that now crashes on the new
// shape. Cheaper than migrating.
const BUSTER = 'v2'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        // Reads are long-lived — no need to hammer the API on tab focus.
        // The persister-driven revalidation already handles freshness.
        refetchOnWindowFocus: false,
        // 7 days in the async storage; queries GC'd before that reload
        // from IDB into memory on next visit.
        gcTime: 7 * 24 * 60 * 60 * 1000,
        // Render's free tier cold-starts take 15-30s. Retry up to 3× with
        // exponential backoff so the second/third call rides on a warm
        // instance. Never retry 4xx (bad request / auth / not found).
        retry: (failureCount, err: unknown) => {
          const status = (err as { response?: { status?: number }; status?: number })?.response?.status
                       ?? (err as { status?: number })?.status
          if (typeof status === 'number' && status >= 400 && status < 500) return false
          return failureCount < 3
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      },
      mutations: { retry: 0 },
    },
  }))

  // Persister must only be created on the client (window / IndexedDB).
  // The `useRef` + effect pattern gives us `undefined` during SSR so
  // PersistQueryClientProvider skips persistence server-side.
  const persisterRef = useRef<ReturnType<typeof createAsyncStoragePersister> | null>(null)
  if (typeof window !== 'undefined' && !persisterRef.current) {
    persisterRef.current = createAsyncStoragePersister({
      storage: idbStorage,
      key: `fanfic-rq:${BUSTER}`,
      // Throttle IDB writes — chapter reads can update the cache many
      // times per second during scroll-driven prefetches; batching every
      // 1s keeps IDB from becoming a hot path.
      throttleTime: 1000,
    })
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: persisterRef.current!,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        buster: BUSTER,
        // Only persist queries whose keys are safe to survive across
        // sessions. Personal/authed lists (profile me, subscriptions,
        // recommendations) go through Zustand and change fast — skip.
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            const key = query.queryKey[0]
            if (typeof key !== 'string') return false
            // Persist: fic details, chapters, public rails, cover fallbacks.
            // Skip: profile/*, subscriptions, for-me, actions/state.
            return (
              key === 'fanfic-full' ||
              key === 'chapter' ||
              key === 'home-rail' ||
              key === 'card-cover-fallback'
            ) && query.state.status === 'success'
          },
        },
      }}
    >
      <ThemeInitializer />
      <ReadingStateHydrator />
      {children}
    </PersistQueryClientProvider>
  )
}
