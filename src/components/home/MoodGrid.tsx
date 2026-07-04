'use client'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface MoodDefinition {
  key: string
  label: string
  emoji: string
  gradient: string // Tailwind gradient classes
  border: string
  /** Query params passed to /discover to seed the mood-based flow */
  query: string
}

/**
 * 6 canonical moods. These are the platform's primary discovery primitive
 * per spec section 0.2. Not a fallback — always visible for both guests
 * and authenticated users.
 */
export const MOODS: MoodDefinition[] = [
  {
    key: 'fluff',
    label: 'Обнимашки',
    emoji: '🫂',
    gradient: 'from-pink-900/50 to-rose-950/40',
    border: 'border-pink-800/40 hover:border-pink-600/60',
    query: 'флафф',
  },
  {
    key: 'angst',
    label: 'Пострадать',
    emoji: '💔',
    gradient: 'from-slate-800/60 to-zinc-950/40',
    border: 'border-slate-700/40 hover:border-slate-500/60',
    query: 'ангст',
  },
  {
    key: 'romance',
    label: 'Влюбиться',
    emoji: '💘',
    gradient: 'from-red-900/50 to-purple-950/40',
    border: 'border-red-800/40 hover:border-red-600/60',
    query: 'романтика',
  },
  {
    key: 'adventure',
    label: 'Приключение',
    emoji: '🗺️',
    gradient: 'from-emerald-900/50 to-teal-950/40',
    border: 'border-emerald-800/40 hover:border-emerald-600/60',
    query: 'приключения',
  },
  {
    key: 'mystery',
    label: 'Загадка',
    emoji: '🔮',
    gradient: 'from-indigo-900/50 to-violet-950/40',
    border: 'border-indigo-800/40 hover:border-indigo-600/60',
    query: 'мистика',
  },
  {
    key: 'humor',
    label: 'Посмеяться',
    emoji: '😄',
    gradient: 'from-amber-900/50 to-orange-950/40',
    border: 'border-amber-800/40 hover:border-amber-600/60',
    query: 'юмор',
  },
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
            className={cn(
              'group relative flex flex-col items-center justify-center gap-2',
              'aspect-[3/2] md:aspect-square rounded-xl bg-gradient-to-br p-3 text-center',
              'border transition-all',
              'hover:scale-[1.02] hover:-translate-y-0.5',
              mood.gradient,
              mood.border
            )}
          >
            <span className="text-3xl md:text-4xl transition-transform group-hover:scale-110" aria-hidden>
              {mood.emoji}
            </span>
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
          <span aria-hidden>{mood.emoji}</span>
          {mood.label}
        </Link>
      ))}
    </div>
  )
}
