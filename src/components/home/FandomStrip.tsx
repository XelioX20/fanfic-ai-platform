'use client'
import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'

export interface FandomItem {
  name: string
  count?: number
  cover?: string
  href?: string
}

const DEFAULT_FANDOMS: FandomItem[] = [
  { name: 'Harry Potter', count: 45200 },
  { name: 'Наруто', count: 32100 },
  { name: 'Marvel', count: 28900 },
  { name: 'Genshin Impact', count: 24500 },
  { name: 'Ориджиналы', count: 22800 },
  { name: 'Шерлок BBC', count: 18700 },
  { name: 'Мстители', count: 17300 },
  { name: 'Homestuck', count: 12600 },
  { name: 'Хоббит', count: 11800 },
  { name: 'Star Wars', count: 10500 },
  { name: 'DC Comics', count: 9800 },
  { name: 'Гравити Фолз', count: 9100 },
]

// Deterministic gradient palette by index — avoids hydration flakiness.
const GRADIENTS = [
  'from-purple-900/70 to-indigo-950/70',
  'from-rose-900/70 to-red-950/70',
  'from-amber-900/70 to-orange-950/70',
  'from-emerald-900/70 to-teal-950/70',
  'from-sky-900/70 to-blue-950/70',
  'from-pink-900/70 to-fuchsia-950/70',
  'from-lime-900/70 to-green-950/70',
  'from-violet-900/70 to-purple-950/70',
]

interface FandomStripProps {
  fandoms?: FandomItem[]
  className?: string
}

/**
 * Horizontal scroll of top fandoms as cards (cover-tinted + name + count).
 * NOT a tag cloud — text-sized-by-count on mobile is a readability antipattern.
 */
export function FandomStrip({ fandoms = DEFAULT_FANDOMS, className }: FandomStripProps) {
  const items = fandoms.slice(0, 12)

  return (
    <section className={cn('space-y-3', className)}>
      <div className="px-1">
        <h2 className="text-lg md:text-xl font-semibold text-zinc-100 leading-tight">
          Фэндомы
        </h2>
        <p className="text-xs md:text-sm text-zinc-500 mt-0.5">
          Загляните к своим любимым вселенным
        </p>
      </div>

      <div
        className="flex gap-2.5 md:gap-3 overflow-x-auto snap-x pb-3 -mx-4 px-4 md:-mx-6 md:px-6 scrollbar-hidden"
      >
        {items.map((f, i) => {
          const href = f.href ?? `/search?q=${encodeURIComponent(f.name)}`
          return (
            <Link
              key={`${f.name}-${i}`}
              href={href}
              className={cn(
                'group flex-shrink-0 w-[160px] md:w-[180px] snap-start',
                'relative rounded-xl overflow-hidden border border-zinc-800 hover:border-zinc-600',
                'transition-all bg-zinc-900'
              )}
              style={{ height: '110px' }}
            >
              {f.cover ? (
                <Image
                  src={f.cover}
                  alt={f.name}
                  fill
                  sizes="(max-width: 640px) 50vw, 200px"
                  className="object-cover opacity-40 group-hover:opacity-60 transition-opacity"
                  loading="lazy"
                />
              ) : (
                <div className={cn('absolute inset-0 bg-gradient-to-br', GRADIENTS[i % GRADIENTS.length])} />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute inset-0 flex flex-col justify-end p-3">
                <p className="text-sm md:text-base font-semibold text-white leading-tight line-clamp-2 drop-shadow">
                  {f.name}
                </p>
                {typeof f.count === 'number' && (
                  <p className="text-xs text-zinc-300 mt-0.5 drop-shadow">
                    {f.count.toLocaleString('ru-RU')} работ
                  </p>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
