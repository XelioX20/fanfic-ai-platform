'use client'
import Link from 'next/link'
import { Dice5, LogIn, UserPlus } from 'lucide-react'
import { useUIStore } from '@/store'
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
 *
 * Theme-aware. In light theme (light/sepia/paper equivalents) we render a
 * soft-white gradient with dark text; in dark themes (dark/amoled) — a deep
 * purple→black gradient with light text. The previous implementation locked
 * to a dark palette which made the subtitle unreadable on light UI theme.
 */
export function WelcomeHero({
  greeting,
  variant = 'guest',
  className,
}: WelcomeHeroProps) {
  const isGuest = variant === 'guest'
  const uiTheme = useUIStore(s => s.theme) as 'light' | 'dark' | 'amoled' | 'fable'
  const isFable = uiTheme === 'fable'
  const isLight = uiTheme === 'light' || isFable

  return (
    <section
      className={cn(
        'rounded-2xl border p-6 md:p-10',
        isFable
          ? 'bg-gradient-to-br from-[#e7efe9] via-[#f7f4ee] to-[#f2ede3] border-[#cfe0d5] shadow-sm'
          : isLight
          ? 'bg-gradient-to-br from-purple-100 via-white to-pink-50 border-purple-200/70 shadow-sm'
          : 'bg-gradient-to-br from-purple-900/50 via-zinc-900 to-zinc-950 border-purple-800/40',
        className,
      )}
    >
      <div className="max-w-2xl">
        <h1
          className={cn(
            'text-2xl md:text-4xl font-bold mb-2 tracking-tight',
            isLight ? 'text-zinc-900' : 'text-zinc-50',
          )}
        >
          {greeting ?? (isGuest ? 'Что почитаем сегодня?' : 'С возвращением')}
        </h1>
        <p
          className={cn(
            'text-sm md:text-base mb-6',
            isLight ? 'text-zinc-700' : 'text-zinc-300',
          )}
        >
          {isGuest
            ? 'AI-подборки фанфиков с ficbook.net — под ваше настроение. Войдите, чтобы сохранять прогресс и подписки.'
            : 'Вы всё прочитали — выберите настроение или доверьтесь случаю.'}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/discover"
            data-pill
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2.5 text-white rounded-lg text-sm font-medium transition-all shadow-lg',
              isFable
                ? 'bg-[#064c37] hover:bg-[#053a2a] shadow-[#064c37]/20'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-purple-900/30',
            )}
          >
            <Dice5 size={16} />
            Помоги выбрать
            <span aria-hidden className="opacity-70">→</span>
          </Link>

          {isGuest ? (
            <>
              <Link
                href="/login"
                data-pill
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border',
                  isLight
                    ? 'bg-white text-zinc-800 border-zinc-300 hover:bg-zinc-50 hover:border-purple-400'
                    : 'bg-zinc-800 text-zinc-100 border-zinc-700 hover:bg-zinc-700',
                )}
              >
                <LogIn size={16} />
                Войти
              </Link>
              <Link
                href="/login?mode=register"
                className={cn(
                  'inline-flex items-center gap-1 text-sm transition-colors',
                  isLight ? 'text-zinc-600 hover:text-purple-700' : 'text-zinc-400 hover:text-purple-400',
                )}
              >
                <UserPlus size={14} />
                Регистрация
              </Link>
            </>
          ) : (
            <Link
              href="/search"
              data-pill
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border',
                isLight
                  ? 'bg-white text-zinc-800 border-zinc-300 hover:bg-zinc-50 hover:border-purple-400'
                  : 'bg-zinc-800 text-zinc-100 border-zinc-700 hover:bg-zinc-700',
              )}
            >
              Каталог
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
