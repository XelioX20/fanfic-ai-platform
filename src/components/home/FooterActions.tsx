'use client'
import Link from 'next/link'
import { Dice5, Library, TrendingUp, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FooterActionsProps {
  isGuest?: boolean
  className?: string
}

/**
 * Bottom nudge — three quick catalog entry points plus (for guests) a
 * registration CTA. Sits at the tail of the home page.
 */
export function FooterActions({ isGuest, className }: FooterActionsProps) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 md:p-8',
        className
      )}
    >
      {isGuest && (
        <div className="mb-5 md:mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-zinc-100 font-medium">Понравилось?</p>
            <p className="text-sm text-zinc-500">
              Создайте аккаунт — сохраняйте прогресс, лайки и подписки.
            </p>
          </div>
          <Link
            href="/login?mode=register"
            data-pill
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-lg text-sm font-medium transition-all"
          >
            <UserPlus size={16} />
            Зарегистрироваться
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link
          href="/discover"
          className="group flex items-center gap-3 p-3 md:p-4 rounded-lg border border-zinc-800 hover:border-purple-800/60 hover:bg-zinc-900 transition-all"
        >
          <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-950/50 flex items-center justify-center text-purple-300 group-hover:bg-purple-900/60 transition-colors">
            <Dice5 size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-100">Случайная работа</p>
            <p className="text-xs text-zinc-500">Не могу выбрать</p>
          </div>
        </Link>

        <Link
          href="/search?q=популярное"
          className="group flex items-center gap-3 p-3 md:p-4 rounded-lg border border-zinc-800 hover:border-purple-800/60 hover:bg-zinc-900 transition-all"
        >
          <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-orange-950/50 flex items-center justify-center text-orange-300 group-hover:bg-orange-900/60 transition-colors">
            <TrendingUp size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-100">Популярное</p>
            <p className="text-xs text-zinc-500">Что все читают</p>
          </div>
        </Link>

        <Link
          href="/search"
          className="group flex items-center gap-3 p-3 md:p-4 rounded-lg border border-zinc-800 hover:border-purple-800/60 hover:bg-zinc-900 transition-all"
        >
          <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-950/50 flex items-center justify-center text-emerald-300 group-hover:bg-emerald-900/60 transition-colors">
            <Library size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-100">Каталог</p>
            <p className="text-xs text-zinc-500">Все работы с фильтрами</p>
          </div>
        </Link>
      </div>
    </section>
  )
}
