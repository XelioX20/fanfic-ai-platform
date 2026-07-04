'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useUIStore } from '@/store'
import { ReadingStateHydrator } from '@/components/ReadingStateHydrator'

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

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        // Don't hammer the API on window focus — most of our reads are
        // long-lived (fic details, chapter lists). The user can pull to
        // refresh if they really want to.
        refetchOnWindowFocus: false,
        // Render's free tier cold-starts take 15–30s and often surface as
        // 502s or timeouts on the first request. Retry up to 3× with
        // exponential backoff so the second/third call rides on a warm
        // instance — but never retry 4xx (bad request / auth / not found).
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

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeInitializer />
      <ReadingStateHydrator />
      {children}
    </QueryClientProvider>
  )
}
