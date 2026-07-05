'use client'
import Link from 'next/link'
import Image from 'next/image'
import { Heart, Sparkles } from 'lucide-react'
import type { Fanfic } from '@/types'
import { cn, formatNumber } from '@/lib/utils'

interface EditorialCollectionProps {
  title: string
  subtitle?: string
  fanfics: Fanfic[]
  loading?: boolean
  emptyLabel?: string
  className?: string
}

function EditorialSkeleton() {
  return (
    <div className="animate-pulse rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
      <div className="aspect-[16/10] bg-zinc-800" />
      <div className="p-4 space-y-2">
        <div className="h-5 bg-zinc-800 rounded w-4/5" />
        <div className="h-3 bg-zinc-800 rounded w-1/2" />
        <div className="h-3 bg-zinc-800 rounded w-full mt-2" />
        <div className="h-3 bg-zinc-800 rounded w-2/3" />
      </div>
    </div>
  )
}

/**
 * "Hidden gems" — 3-column grid layout signalling a curated object,
 * per Spotify's Discover Weekly pattern. NOT a rail.
 */
export function EditorialCollection({
  title,
  subtitle,
  fanfics,
  loading,
  emptyLabel = 'Пока пусто — загляните позже.',
  className,
}: EditorialCollectionProps) {
  const items = fanfics.slice(0, 6)

  return (
    <section className={cn('space-y-4', className)}>
      <div className="px-1 flex items-start gap-2">
        <Sparkles size={20} className="text-purple-400 flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <h2 className="text-lg md:text-xl font-semibold text-zinc-100 leading-tight">
            {title}
          </h2>
          <p className="text-xs md:text-sm text-zinc-500 mt-0.5">
            {subtitle ?? 'Высокий рейтинг, мало просмотров — истории, которые заслуживают быть найденными'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {Array.from({ length: 3 }).map((_, i) => <EditorialSkeleton key={i} />)}
        </div>
      ) : items.length === 0 ? (
        <div className="text-sm text-zinc-500 py-6 px-1">{emptyLabel}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {items.map((fic) => (
            <Link
              key={fic.id}
              href={`/fanfic/${fic.id}`}
              className="group flex flex-col rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 hover:border-purple-800/60 transition-all"
            >
              <div className="relative aspect-[16/10] bg-zinc-800 overflow-hidden">
                {fic.cover_url ? (
                  <Image
                    src={fic.cover_url}
                    alt={fic.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-950/40 to-zinc-900">
                    <Sparkles size={24} className="text-zinc-700" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                {fic.likes > 0 && (
                  <span className="absolute top-2 right-2 inline-flex items-center gap-1 text-xs text-white bg-black/60 px-2 py-1 rounded">
                    <Heart size={11} className="fill-current text-pink-400" />
                    {formatNumber(fic.likes)}
                  </span>
                )}
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <h3 className="font-semibold text-zinc-100 group-hover:text-purple-300 transition-colors line-clamp-2 leading-snug">
                  {fic.title}
                </h3>
                {fic.author_name && (
                  <p className="text-xs text-zinc-500 mt-1">{fic.author_name}</p>
                )}
                {fic.description && (
                  <p className="text-sm text-zinc-400 mt-2 line-clamp-3 leading-relaxed">
                    {fic.description}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
