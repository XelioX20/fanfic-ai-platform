import { cn } from '@/lib/utils'

interface RailSkeletonProps {
  count?: number
  className?: string
}

/**
 * Skeleton loader for a horizontal rail of CompactFanficCards.
 * Matches the ~160px/180px card width and 2:3 aspect ratio.
 */
export function RailSkeleton({ count = 6, className }: RailSkeletonProps) {
  return (
    <div className={cn('flex gap-3 md:gap-4 overflow-hidden', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex-shrink-0 w-[160px] md:w-[180px] animate-pulse"
        >
          <div className="aspect-[2/3] w-full bg-zinc-800 rounded-lg" />
          <div className="mt-2 h-4 bg-zinc-800 rounded w-11/12" />
          <div className="mt-1.5 h-3 bg-zinc-800 rounded w-2/3" />
          <div className="mt-1 h-3 bg-zinc-800 rounded w-1/2" />
        </div>
      ))}
    </div>
  )
}
