import type { Fanfic } from '@/types'
import { FanficCard } from './FanficCard'
import { cn } from '@/lib/utils'

interface FanficGridProps {
  fanfics: Fanfic[]
  loading?: boolean
  className?: string
}

function SkeletonCard() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 animate-pulse">
      <div className="flex gap-3 mb-3">
        <div className="h-4 w-16 bg-zinc-800 rounded" />
        <div className="h-4 w-12 bg-zinc-800 rounded" />
        <div className="h-4 w-20 bg-zinc-800 rounded" />
      </div>
      <div className="h-5 bg-zinc-800 rounded w-3/4 mb-2" />
      <div className="h-3 bg-zinc-800 rounded w-1/3 mb-2" />
      <div className="h-3 bg-zinc-800 rounded w-1/2 mb-3" />
      <div className="flex gap-1.5 mb-3">
        {[1,2,3,4].map(i => <div key={i} className="h-5 w-14 bg-zinc-800 rounded" />)}
      </div>
      <div className="h-3 bg-zinc-800 rounded w-full mb-1" />
      <div className="h-3 bg-zinc-800 rounded w-5/6" />
    </div>
  )
}

export function FanficGrid({ fanfics, loading, className }: FanficGridProps) {
  if (loading) {
    return (
      <div className={cn('space-y-3', className)}>
        {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    )
  }

  if (!fanfics.length) {
    return (
      <div className="text-center py-16 text-zinc-600">
        <p className="text-lg">Фанфики не найдены</p>
        <p className="text-sm mt-1">Попробуйте изменить параметры поиска</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      {fanfics.map((fanfic) => (
        <FanficCard key={fanfic.id} fanfic={fanfic} />
      ))}
    </div>
  )
}
