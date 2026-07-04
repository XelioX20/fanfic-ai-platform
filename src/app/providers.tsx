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
      queries: { staleTime: 60 * 1000, retry: 1 },
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
