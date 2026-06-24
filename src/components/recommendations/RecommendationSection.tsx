'use client'
import { useQuery } from '@tanstack/react-query'
import { recommendationsApi } from '@/lib/api'
import { FanficGrid } from '@/components/fanfic/FanficGrid'
import { MOCK_FANFICS } from '@/lib/mock-data'

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
    retry: false,
  })

  const fanfics = data?.items ?? (
    type === 'trending'
      ? MOCK_FANFICS.filter(f => f.is_hot || f.likes > 4000)
      : MOCK_FANFICS.slice(0, 4)
  )

  return (
    <section>
      <h2 className="text-lg font-semibold text-zinc-200 mb-4">{title}</h2>
      <FanficGrid fanfics={fanfics} loading={isLoading} />
    </section>
  )
}
