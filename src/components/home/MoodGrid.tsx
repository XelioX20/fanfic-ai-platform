'use client'
import Link from 'next/link'
import { HeartHandshake, HeartCrack, Heart, Map, Sparkles, Laugh, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MoodDefinition {
  key: string
  label: string
  Icon: LucideIcon
  /** Query params passed to /discover to seed the mood-based flow */
  query: string
}

/**
 * 6 canonical moods. The platform's primary discovery primitive — always
 * visible for guests and authed users. Icons (lucide, no emoji) keep the
 * literary style consistent; tiles use a single neutral chip surface that
 * the Fable theme recolors to mint via [data-chip].
 */
export const MOODS: MoodDefinition[] = [
  { key: 'fluff',     label: 'Обнимашки',   Icon: HeartHandshake, query: 'флафф' },
  { key: 'angst',     label: 'Пострадать',  Icon: HeartCrack,     query: 'ангст' },
  { key: 'romance',   label: 'Влюбиться',   Icon: Heart,          query: 'романтика' },
  { key: 'adventure', label: 'Приключение', Icon: Map,            query: 'приключения' },
  { key: 'mystery',   label: 'Загадка',     Icon: Sparkles,       query: 'мистика' },
  { key: 'humor',     label: 'Посмеяться',  Icon: Laugh,          query: 'юмор' },
]

interface MoodGridProps {
  className?: string
}

export function MoodGrid({ className }: MoodGridProps) {
  return (
    <section className={cn('space-y-3', className)}>
      <div className="px-1">
        <h2 className="text-lg md:text-xl font-semibold text-zinc-100 leading-tight">
          Что сегодня хочется?
        </h2>
        <p className="text-xs md:text-sm text-zinc-500 mt-0.5">
          Выберите настроение — покажем подборку
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
        {MOODS.map((mood) => (
          <Link
            key={mood.key}
            href={`/search?q=${encodeURIComponent(mood.query)}`}
            data-chip
            className={cn(
              'group relative flex flex-col items-center justify-center gap-2',
              'aspect-[3/2] md:aspect-square rounded-xl p-3 text-center',
              'bg-zinc-900 border border-zinc-800 transition-all',
              'hover:scale-[1.02] hover:-translate-y-0.5 hover:border-zinc-600'
            )}
          >
            <mood.Icon
              size={28}
              className="text-purple-400 transition-transform group-hover:scale-110"
              aria-hidden
            />
            <span className="text-sm md:text-base font-medium text-zinc-100 leading-tight">
              {mood.label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}

interface MoodChipsProps {
  className?: string
}

/**
 * Compact chip row of moods. Used inside the WelcomeHero or as a lightweight
 * alternative to the full MoodGrid.
 */
export function MoodChips({ className }: MoodChipsProps) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {MOODS.map((mood) => (
        <Link
          key={mood.key}
          href={`/search?q=${encodeURIComponent(mood.query)}`}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full',
            'bg-zinc-900 border border-zinc-800',
            'hover:border-zinc-600 hover:bg-zinc-800',
            'text-sm text-zinc-300 hover:text-white transition-colors'
          )}
        >
          <mood.Icon size={15} className="text-purple-400" aria-hidden />
          {mood.label}
        </Link>
      ))}
    </div>
  )
}
