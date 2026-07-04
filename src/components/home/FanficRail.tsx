'use client'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { Fanfic } from '@/types'
import { cn } from '@/lib/utils'
import { CompactFanficCard } from './CompactFanficCard'
import { RailSkeleton } from './RailSkeleton'

interface FanficRailProps {
  title: string
  subtitle?: string
  fanfics: Fanfic[]
  loading?: boolean
  error?: boolean
  seeAllHref?: string
  emptyLabel?: string
  className?: string
  skeletonCount?: number
}

/**
 * Horizontally-scrolling rail of CompactFanficCards.
 *
 * - snap-x + snap-start for touch-friendly mobile scrolling
 * - scrollbar-hidden for a native app feel
 * - fade edges via mask-image so overflow is obvious
 */
export function FanficRail({
  title,
  subtitle,
  fanfics,
  loading,
  error,
  seeAllHref,
  emptyLabel,
  className,
  skeletonCount = 6,
}: FanficRailProps) {
  // Hide rail entirely when finished loading and no items and no error
  const isEmpty = !loading && !error && fanfics.length === 0
  if (isEmpty && !emptyLabel) return null

  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 className="text-lg md:text-xl font-semibold text-zinc-100 leading-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs md:text-sm text-zinc-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        {seeAllHref && !loading && fanfics.length > 0 && (
          <Link
            href={seeAllHref}
            className="flex-shrink-0 inline-flex items-center gap-0.5 text-xs md:text-sm text-zinc-400 hover:text-purple-400 transition-colors"
          >
            Смотреть все
            <ChevronRight size={14} />
          </Link>
        )}
      </div>

      {loading ? (
        <RailSkeleton count={skeletonCount} />
      ) : error ? (
        <div className="text-sm text-zinc-500 py-6 px-1">
          Не удалось загрузить. Попробуйте обновить страницу.
        </div>
      ) : isEmpty ? (
        <div className="text-sm text-zinc-500 py-6 px-1">{emptyLabel}</div>
      ) : (
        <div
          className={cn(
            'flex gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory pb-3',
            '-mx-4 px-4 md:-mx-6 md:px-6',
            'scrollbar-hidden'
          )}
        >
          {fanfics.map((fic) => (
            <CompactFanficCard key={fic.id} fanfic={fic} />
          ))}
        </div>
      )}
    </section>
  )
}
