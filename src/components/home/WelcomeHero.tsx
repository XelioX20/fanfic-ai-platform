'use client'
import Link from 'next/link'
import { Dice5, LogIn, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WelcomeHeroProps {
  greeting?: string
  variant?: 'guest' | 'authed-caught-up'
  className?: string
}

/**
 * Welcome hero.
 *
 * - Guest: greeting + login CTA (soft, not modal).
 * - Authed-caught-up: greeting + quiz CTA (used when auth store has no readingProgress).
 */
export function WelcomeHero({
  greeting,
  variant = 'guest',
  className,
}: WelcomeHeroProps) {
  const isGuest = variant === 'guest'

  return (
    <section
      className={cn(
        'rounded-2xl bg-gradient-to-br from-purple-950/30 via-zinc-900 to-zinc-900',
        'border border-zinc-800 p-6 md:p-10',
        className
      )}
    >
      <div className="max-w-2xl">
        <h1 className="text-2xl md:text-4xl font-bold text-zinc-100 mb-2 tracking-tight">
          {greeting ?? (isGuest ? 'Что почитаем сегодня?' : 'С возвращением')}
        </h1>
        <p className="text-sm md:text-base text-zinc-400 mb-6">
          {isGuest
            ? 'AI-подборки фанфиков с ficbook.net — под ваше настроение. Войдите, чтобы сохранять прогресс и подписки.'
            : 'Вы всё прочитали — выберите настроение или доверьтесь случаю.'}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/discover"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-purple-900/30"
          >
            <Dice5 size={16} />
            Помоги выбрать
            <span aria-hidden className="opacity-70">→</span>
          </Link>

          {isGuest ? (
            <>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 rounded-lg text-sm font-medium transition-all"
              >
                <LogIn size={16} />
                Войти
              </Link>
              <Link
                href="/login?mode=register"
                className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-purple-400 transition-colors"
              >
                <UserPlus size={14} />
                Регистрация
              </Link>
            </>
          ) : (
            <Link
              href="/search"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 rounded-lg text-sm font-medium transition-all"
            >
              Каталог
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
