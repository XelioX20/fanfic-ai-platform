'use client'
import Link from 'next/link'
import { Heart, BookOpen } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import type { Fanfic } from '@/types'
import { cn, formatNumber } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface CompactFanficCardProps {
  fanfic: Fanfic
  className?: string
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
 * Cover-URL fallback: ficbook's /fanfiction listing sometimes omits the
 * cover image for fics served through certain paths (premium redirects,
 * UUID-only ids). When our proxy hands us a card without cover_url, we
 * lazily hit /api/v1/fanfics/{id}/full — which scrapes the fic's detail
 * page where the cover IS present — and use that. Cached via React Query
 * for the session so we don't refetch on rail scroll.
 */

async function fetchCoverFallback(id: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/fanfics/${id}/full`)
    if (!res.ok) return null
    const data = await res.json()
    return (data.cover_url as string | null) ?? null
  } catch {
    return null
  }
}

export function CompactFanficCard({ fanfic, className }: CompactFanficCardProps) {
  const primaryAuthor = fanfic.author_name
  const primaryFandom = fanfic.fandoms?.[0]
  const ratingCls = RATING_COLOR[fanfic.rating] ?? 'bg-zinc-800/80 text-zinc-300'

  const coverQuery = useQuery({
    queryKey: ['card-cover-fallback', fanfic.id],
    queryFn: () => fetchCoverFallback(fanfic.id),
    enabled: !fanfic.cover_url && !!fanfic.id,
    staleTime: 10 * 60 * 1000,
    retry: 0,
  })

  const effectiveCover = fanfic.cover_url ?? coverQuery.data ?? null

  return (
    <Link
      href={`/fanfic/${fanfic.id}`}
      className={cn(
        'group flex-shrink-0 w-[160px] md:w-[180px] snap-start',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded-lg',
        className
      )}
    >
      <div className="relative aspect-[2/3] w-full rounded-lg overflow-hidden bg-zinc-800 border border-zinc-800 group-hover:border-zinc-600 transition-colors">
        {effectiveCover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={effectiveCover}
            alt={fanfic.title}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        ) : (
          // No cover on ficbook + fallback fetch didn't yield one either.
          // Render a decorative placeholder with icon + title so the card
          // reads clearly rather than being a flat grey rectangle.
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
