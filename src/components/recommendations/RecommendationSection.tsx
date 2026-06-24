'use client'
import { useQuery } from '@tanstack/react-query'
import { recommendationsApi, fanficsApi } from '@/lib/api'
import { FanficGrid } from '@/components/fanfic/FanficGrid'
import type { Fanfic } from '@/types'

interface RecommendationSectionProps {
  title: string
  type: 'trending' | 'for-me'
}

export function RecommendationSection({ title, type }: RecommendationSectionProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['recommendations', type],
    queryFn: async () => {
      if (type === 'trending') {
        const res = await recommendationsApi.trending()
        return res.data
      }
      const res = await recommendationsApi.forMe()
      return res.data
    },
    staleTime: 5 * 60 * 1000,
  })

  return (
    <section>
      <h2 className="text-lg font-semibold text-zinc-200 mb-4">{title}</h2>
      <FanficGrid fanfics={data?.items || []} loading={isLoading} />
    </section>
  )
}
