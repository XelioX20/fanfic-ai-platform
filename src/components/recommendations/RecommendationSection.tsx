'use client'
import { useQuery } from '@tanstack/react-query'
import { FanficGrid } from '@/components/fanfic/FanficGrid'
import type { Fanfic } from '@/types'

interface RecommendationSectionProps {
  title: string
  type: 'trending' | 'for-me'
}

const SECTION_PATHS: Record<string, string> = {
  'trending': 'popular-fanfics-376846',
  'for-me': 'popular-fanfics-376846/het',
}

export function RecommendationSection({ title, type }: RecommendationSectionProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['fanfics-proxy', type],
    queryFn: async () => {
      const path = SECTION_PATHS[type] || 'popular-fanfics-376846'
      const res = await fetch(`/api/ficbook/list?path=${encodeURIComponent(path)}&p=1`)
      const data = await res.json()
      return data
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
