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
      <div className="h-4 bg-zinc-800 rounded w-3/4 mb-2" />
      <div className="h-3 bg-zinc-800 rounded w-1/2 mb-3" />
      <div className="h-3 bg-zinc-800 rounded w-full mb-2" />
      <div className="h-3 bg-zinc-800 rounded w-5/6 mb-3" />
      <div className="flex gap-2">
        <div className="h-5 w-16 bg-zinc-800 rounded" />
        <div className="h-5 w-12 bg-zinc-800 rounded" />
        <div className="h-5 w-20 bg-zinc-800 rounded" />
      </div>
    </div>
  )
}

export function FanficGrid({ fanfics, loading, className }: FanficGridProps) {
  if (loading) {
    return (
      <div className={cn('space-y-3', className)}>
        {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
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
