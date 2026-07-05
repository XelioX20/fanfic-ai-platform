'use client'
import Link from 'next/link'
import Image from 'next/image'
import { Heart, BookOpen } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import type { Fanfic } from '@/types'
import { cn, formatNumber } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface CompactFanficCardProps {
  fanfic: Fanfic
  className?: string
  /** Mark the first few above-the-fold covers as high priority so the
   *  browser prioritises them and LCP is measured correctly. */
  priority?: boolean
}

const RATING_COLOR: Record<string, string> = {
  'G':     'bg-emerald-900/70 text-emerald-200',
  'PG-13': 'bg-yellow-900/70 text-yellow-200',
  'R':     'bg-orange-900/70 text-orange-200',
  'NC-17': 'bg-red-900/70 text-red-200',
  'NC-21': 'bg-red-950/80 text-red-200',
}

/**
 * Small, poster-first card used inside horizontal rails.
 *
 * We removed the lazy fallback fetch to /api/v1/fanfics/{id}/full that was
 * previously used to try to fill in missing cover_url values. Investigation
 * showed that fics without a cover in the listing HTML genuinely have no
 * cover anywhere on ficbook — the fallback fetch always returned null while
 * adding a slow round-trip to Render for every cover-less card. Removing it
 * makes the rail load instantly; cover-less fics show a clean placeholder.
 *
 * On hover/focus we prefetch /fanfics/{id}/full into React Query so the
 * detail page renders instantly when the user clicks. Backend caches the
 * response for 15 min so prefetch is essentially free.
 */
export function CompactFanficCard({ fanfic, className, priority = false }: CompactFanficCardProps) {
  const primaryAuthor = fanfic.author_name
  const primaryFandom = fanfic.fandoms?.[0]
  const ratingCls = RATING_COLOR[fanfic.rating] ?? 'bg-zinc-800/80 text-zinc-300'
  const queryClient = useQueryClient()

  const prefetchDetail = () => {
    if (!fanfic.id) return
    queryClient.prefetchQuery({
      queryKey: ['fanfic-full', fanfic.id],
      queryFn: async () => {
        const r = await fetch(`${API_URL}/api/v1/fanfics/${fanfic.id}/full`)
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      },
      staleTime: 5 * 60 * 1000, // matches backend Cache-Control max-age
    })
  }

  return (
    <Link
      href={`/fanfic/${fanfic.id}`}
      onMouseEnter={prefetchDetail}
      onFocus={prefetchDetail}
      onTouchStart={prefetchDetail}
      className={cn(
        'group flex-shrink-0 w-[160px] md:w-[180px] snap-start',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded-lg',
        className
      )}
    >
      <div className="relative aspect-[2/3] w-full rounded-lg overflow-hidden bg-zinc-800 border border-zinc-800 group-hover:border-zinc-600 transition-colors">
        {fanfic.cover_url ? (
          <Image
            src={fanfic.cover_url}
            alt={fanfic.title}
            fill
            // Give the optimizer the actual rendered sizes so it can
            // request AVIF/WebP variants of the right resolution instead
            // of the full 900×1200 source. 60-80% payload cut on rails.
            sizes="(max-width: 768px) 160px, 180px"
            priority={priority}
            loading={priority ? 'eager' : 'lazy'}
            className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black p-3">
            <BookOpen size={28} className="text-zinc-600 shrink-0" />
            <span className="text-zinc-400 text-xs text-center line-clamp-4 leading-tight">
              {fanfic.title}
            </span>
          </div>
        )}

        {/* Bottom gradient with rating chip + likes */}
        <div className="absolute inset-x-0 bottom-0 p-1.5 flex items-end justify-between gap-1 bg-gradient-to-t from-black/80 via-black/30 to-transparent">
          {fanfic.rating && fanfic.rating !== 'Неизвестно' ? (
            <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', ratingCls)}>
              {fanfic.rating}
            </span>
          ) : <span />}
          {fanfic.likes > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-white/90 bg-black/50 px-1.5 py-0.5 rounded">
              <Heart size={9} className="fill-current" />
              {formatNumber(fanfic.likes)}
            </span>
          )}
        </div>

        {fanfic.is_hot && (
          <span className="absolute top-1.5 left-1.5 bg-orange-600/90 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
            🔥
          </span>
        )}
      </div>

      <div className="mt-2 px-0.5">
        <h3 className="text-sm font-medium text-zinc-100 leading-snug line-clamp-2 group-hover:text-purple-300 transition-colors">
          {fanfic.title}
        </h3>
        {primaryAuthor && (
          <p className="text-xs text-zinc-500 truncate mt-0.5">{primaryAuthor}</p>
        )}
        {primaryFandom && (
          <p className="text-xs text-zinc-600 truncate mt-0.5">{primaryFandom}</p>
        )}
      </div>
    </Link>
  )
}
