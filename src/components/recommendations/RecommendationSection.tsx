'use client'
import { useQuery } from '@tanstack/react-query'
import { FanficGrid } from '@/components/fanfic/FanficGrid'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface RecommendationSectionProps {
  title: string
  type: 'trending' | 'for-me'
}

// Only /fanfiction returns full static HTML — use it with direction filters.
// The obfuscated /popular-fanfics-376846 renders via Vue and has no article cards in HTML.
const SECTION_PATHS: Record<string, string> = {
  'trending': 'fanfiction',
  'for-me': 'fanfiction?direction=het',
}

export function RecommendationSection({ title, type }: RecommendationSectionProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['fanfics-backend', type],
    queryFn: async () => {
      const path = SECTION_PATHS[type] || 'fanfiction'
      // Use backend endpoint — full BeautifulSoup parser with tags/size/description/pairings
      const res = await fetch(`${API_URL}/api/v1/search/list?path=${encodeURIComponent(path)}&page=1`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  return (
    <section>
      <h2 className="text-lg font-semibold text-zinc-200 mb-4">{title}</h2>
      <FanficGrid fanfics={data?.items ?? []} loading={isLoading} />
    </section>
  )
}
