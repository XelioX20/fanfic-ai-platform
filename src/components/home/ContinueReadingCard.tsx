'use client'
import Link from 'next/link'
import { Play, BookOpen } from 'lucide-react'
import type { Fanfic } from '@/types'
import { cn } from '@/lib/utils'

export interface ReadingProgressEntry {
  fanficId: string
  chapterId: string | 'single'
  scrollY: number
  progressKey: string
}

interface ContinueReadingHeroProps {
  entry: ReadingProgressEntry
  fanfic: Fanfic | null
  loading?: boolean
  /** Approximate percent 0..100 based on scrollY vs a heuristic max; optional. */
  percent?: number
  chapterTitle?: string
  chapterIndex?: number
  chapterTotal?: number
  className?: string
}

function relativeTime(iso?: string): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (isNaN(t)) return ''
  const diff = Date.now() - t
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'только что'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} мин. назад`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ч. назад`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} дн. назад`
  return new Date(iso).toLocaleDateString('ru-RU')
}

export function ContinueReadingHero({
  entry,
  fanfic,
  loading,
  percent,
  chapterTitle,
  chapterIndex,
  chapterTotal,
  className,
}: ContinueReadingHeroProps) {
  const readHref =
    entry.chapterId === 'single'
      ? `/fanfic/${entry.fanficId}/read`
      : `/fanfic/${entry.fanficId}/read/${entry.chapterId}`
  const tocHref = `/fanfic/${entry.fanficId}`

  return (
    <section
      className={cn(
        'rounded-2xl bg-gradient-to-br from-indigo-950/40 via-zinc-900/80 to-zinc-900',
        'border border-indigo-800/30 p-5 md:p-8 shadow-lg shadow-indigo-950/20',
        className
      )}
    >
      <div className="grid grid-cols-[100px_1fr] md:grid-cols-[200px_1fr] gap-5 md:gap-6 items-start">
        {/* Cover */}
        <Link href={tocHref} className="block">
          <div className="relative w-full aspect-[2/3] rounded-lg overflow-hidden bg-zinc-800 shadow-xl">
            {loading ? (
              <div className="absolute inset-0 bg-zinc-800 animate-pulse" />
            ) : fanfic?.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={fanfic.cover_url}
                alt={fanfic.title}
                className="absolute inset-0 w-full h-full object-cover"
                loading="eager"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-indigo-900/30 to-zinc-800">
                <BookOpen size={28} className="text-zinc-600" />
              </div>
            )}
          </div>
        </Link>

        {/* Right column */}
        <div className="min-w-0 flex flex-col gap-3">
          <p className="text-xs uppercase tracking-wider text-indigo-300 font-medium">
            Продолжить чтение
          </p>

          {loading ? (
            <>
              <div className="h-7 md:h-9 bg-zinc-800 rounded w-4/5 animate-pulse" />
              <div className="h-4 bg-zinc-800 rounded w-3/5 animate-pulse" />
            </>
          ) : fanfic ? (
            <>
              <Link href={tocHref}>
                <h2 className="text-xl md:text-3xl font-bold text-zinc-100 leading-tight hover:text-purple-300 transition-colors line-clamp-2">
                  {fanfic.title}
                </h2>
              </Link>

              <div className="text-sm text-zinc-400 flex flex-wrap items-center gap-x-2 gap-y-1">
                {fanfic.author_name && <span>{fanfic.author_name}</span>}
                {fanfic.fandoms?.[0] && (
                  <>
                    <span className="text-zinc-700">·</span>
                    <span className="truncate max-w-[200px]">{fanfic.fandoms[0]}</span>
                  </>
                )}
                {fanfic.rating && fanfic.rating !== 'Неизвестно' && (
                  <>
                    <span className="text-zinc-700">·</span>
                    <span>{fanfic.rating}</span>
                  </>
                )}
              </div>

              {(chapterTitle || (chapterIndex != null && chapterTotal != null)) && (
                <p className="text-sm text-zinc-400 line-clamp-1">
                  {chapterIndex != null && chapterTotal != null && chapterTotal > 1 && (
                    <>
                      Глава {chapterIndex} из {chapterTotal}
                      {chapterTitle ? ': ' : ''}
                    </>
                  )}
                  {chapterTitle && <span className="text-zinc-300">{chapterTitle}</span>}
                </p>
              )}
            </>
          ) : (
            <p className="text-zinc-400 text-sm">Не удалось загрузить работу.</p>
          )}

          {/* Progress bar */}
          {typeof percent === 'number' && (
            <div className="mt-1 h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-400 to-violet-400 transition-all duration-500"
                style={{ width: `${Math.max(2, Math.min(100, percent))}%` }}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-2">
            <Link
              href={readHref}
              className="inline-flex items-center gap-1.5 px-4 py-2 md:px-5 md:py-2.5 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-900/30"
            >
              <Play size={14} className="fill-current" />
              Читать дальше
            </Link>
            <Link
              href={tocHref}
              className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors px-2 py-1"
            >
              К оглавлению
            </Link>
          </div>

          {fanfic?.updated_at && (
            <p className="text-xs text-zinc-500 mt-0.5">
              Читали {relativeTime(fanfic.updated_at)}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
