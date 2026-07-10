'use client'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { BookOpen, Link2, X, ArrowRight, Sun, Moon, Smartphone } from 'lucide-react'
import { useAuthStore, useUIStore } from '@/store'
import { SearchBar } from '@/components/search/SearchBar'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'

const THEMES = [
  { value: 'light'  as const, label: 'Светлая', hint: 'светлый фон',        Icon: Sun },
  { value: 'dark'   as const, label: 'Тёмная',  hint: 'мягкий тёмно-серый', Icon: Moon },
  { value: 'amoled' as const, label: 'AMOLED',  hint: 'чистый чёрный',      Icon: Smartphone },
  { value: 'fable'  as const, label: 'Fable',   hint: 'кремовая бумага',    Icon: BookOpen },
]

function ThemeToggle() {
  const { theme, setTheme } = useUIStore()
  const [open, setOpen] = useState(false)
  const current = THEMES.find(t => t.value === theme) ?? THEMES[0]
  const { Icon } = current
  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        title="Сменить тему"
        onClick={() => setOpen(o => !o)}
        className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors"
      >
        <Icon size={18} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-48 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 py-1 overflow-hidden">
            {THEMES.map(({ value, label, hint, Icon: TIcon }) => (
              <button
                key={value}
                type="button"
                onClick={() => { setTheme(value); setOpen(false) }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left',
                  theme === value
                    ? 'text-purple-400 bg-purple-950/30'
                    : 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'
                )}
              >
                <TIcon size={14} className="flex-shrink-0" />
                <span className="flex-1 flex flex-col leading-tight">
                  <span>{label}</span>
                  <span className="text-[10px] text-zinc-500">{hint}</span>
                </span>
                {theme === value && <span className="text-purple-400 text-xs">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function parseFicbookUrl(input: string): string | null {
  try {
    const url = input.trim()
    // Match ficbook.net/readfic/{id} or ficbook.net/readfic/{id}/{chapter}
    const match = url.match(/ficbook\.net\/readfic\/([\w-]+)/)
    if (match) return match[1]
    // Match just an ID (UUID or numeric)
    const uuidMatch = url.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i)
    if (uuidMatch) return uuidMatch[1]
    const numMatch = url.match(/^(\d{5,})$/)
    if (numMatch) return numMatch[1]
  } catch {}
  return null
}

function OpenByLinkModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleOpen = () => {
    const id = parseFicbookUrl(value)
    if (!id) {
      setError('Не удалось распознать ссылку. Вставь ссылку вида ficbook.net/readfic/...')
      return
    }
    onClose()
    router.push(`/fanfic/${id}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleOpen()
    if (e.key === 'Escape') onClose()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md px-4">
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
              <Link2 size={15} className="text-purple-400" />
              Открыть по ссылке
            </h2>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="relative">
            <input
              ref={inputRef}
              value={value}
              onChange={e => { setValue(e.target.value); setError('') }}
              onKeyDown={handleKeyDown}
              placeholder="https://ficbook.net/readfic/..."
              className="w-full px-3 py-2.5 pr-10 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-purple-500 text-sm transition-colors"
            />
            {value && (
              <button
                type="button"
                onClick={() => { setValue(''); setError('') }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {error && (
            <p className="text-red-400 text-xs mt-2">{error}</p>
          )}

          <p className="text-zinc-600 text-xs mt-2">
            Поддерживаются ссылки вида: ficbook.net/readfic/...
          </p>

          <button
            onClick={handleOpen}
            disabled={!value.trim()}
            data-pill
            className="mt-4 w-full flex items-center justify-center gap-2 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
          >
            Открыть <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </>
  )
}

export function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, accessToken } = useAuthStore()
  const [linkModalOpen, setLinkModalOpen] = useState(false)


  // Hide the global header in reader routes — they have their own
  // in-page top bar (chapter title, chapter list, reader settings) which
  // is what users expect to see there. Site search + profile chip live
  // above and are reachable from every other route.
  //
  // Paths that count as "reader":
  //   /fanfic/{id}/read              (single-chapter)
  //   /fanfic/{id}/read/{chapter_id} (multi-chapter)
  const isReader = /^\/fanfic\/[^/]+\/read(\/|$)/.test(pathname ?? '')
  if (isReader) return null

  return (
    <>
      <header className="sticky top-0 z-50 bg-zinc-900/95 backdrop-blur border-b border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <BookOpen size={20} className="text-purple-500" />
            <span className="font-bold text-zinc-100 hidden sm:block">Fanfic AI</span>
          </Link>

          {/* Search */}
          <div className="flex-1 max-w-xl">
            <SearchBar className="w-full" />
          </div>

          {/* Open by link button */}
          <button
            onClick={() => setLinkModalOpen(true)}
            title="Открыть по ссылке"
            className="flex-shrink-0 p-2 text-zinc-500 hover:text-purple-400 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <Link2 size={18} />
          </button>

          {/* Theme toggle */}
          <ThemeToggle />

          {/* Auth */}
          <div className="flex-shrink-0">
            {!accessToken ? (
              <Link
                href="/login"
                data-pill
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Войти
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                {/* Avatar + username — click goes to profile */}
                <Link
                  href="/profile"
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  <Avatar
                    src={user?.custom_avatar_url || user?.ficbook_avatar_url}
                    alt={user?.ficbook_username || 'avatar'}
                    size={28}
                  />
                  <span className="text-zinc-300 text-sm hidden sm:block max-w-[120px] truncate">
                    {user?.ficbook_username || 'Профиль'}
                  </span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {linkModalOpen && <OpenByLinkModal onClose={() => setLinkModalOpen(false)} />}
    </>
  )
}
