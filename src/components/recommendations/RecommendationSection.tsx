'use client'
import { useQuery } from '@tanstack/react-query'
import { fanficsApi } from '@/lib/api'
import { FanficGrid } from '@/components/fanfic/FanficGrid'

interface RecommendationSectionProps {
  title: string
  type: 'trending' | 'for-me'
}

export function RecommendationSection({ title, type }: RecommendationSectionProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['fanfics-list', type],
    queryFn: async () => {
      // Use main fanfics API — works without recommendation-engine
      const params: Record<string, unknown> = { page: 1, page_size: 20 }
      const res = await fanficsApi.list(params)
      return res.data
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
