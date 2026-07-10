'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Library, Compass, User, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Mobile bottom tab bar — the primary navigation on phones (hidden md+).
 *
 * Matches the Stitch "Literary Fable" reference, which puts a fixed
 * bottom bar on every mobile screen. Uses zinc/purple utility classes so
 * the existing per-theme overrides in globals.css (.fable/.light/.dark/
 * .amoled) recolor it for free — no raw hexes here.
 *
 * Hidden on:
 *   - reader routes (immersive focus mode — mirrors Header's isReader)
 *   - /login (auth flow, no chrome)
 *   - /profile (it has its own in-page bottom tab switcher — avoids two
 *     stacked bars)
 */

interface Tab {
  href: string
  label: string
  Icon: LucideIcon
  /** exact match (home) vs startsWith (sections) */
  exact?: boolean
}

const TABS: Tab[] = [
  { href: '/', label: 'Главная', Icon: Home, exact: true },
  { href: '/search', label: 'Каталог', Icon: Library },
  { href: '/discover', label: 'Подбор', Icon: Compass },
  { href: '/profile', label: 'Профиль', Icon: User },
]

export function BottomNav() {
  const pathname = usePathname() ?? '/'

  const isReader = /^\/fanfic\/[^/]+\/read(\/|$)/.test(pathname)
  const isHiddenRoute = pathname === '/login' || pathname.startsWith('/profile')
  if (isReader || isHiddenRoute) return null

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-zinc-900/95 backdrop-blur-md border-t border-zinc-800"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex justify-around items-stretch h-16 max-w-5xl mx-auto px-2">
        {TABS.map(({ href, label, Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors',
                active ? 'text-purple-400' : 'text-zinc-500 hover:text-zinc-300',
              )}
            >
              <span
                {...(active ? { 'data-chip-active': '' } : {})}
                className={cn(
                  'inline-flex items-center justify-center rounded-full transition-all',
                  active ? 'px-4 py-1' : 'px-2 py-1',
                )}
              >
                <Icon size={22} strokeWidth={active ? 2.4 : 2} />
              </span>
              <span className={cn('text-[11px] leading-none', active && 'font-semibold')}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
