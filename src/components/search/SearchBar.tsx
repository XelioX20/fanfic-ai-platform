'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Clock, Wand2, Shuffle, ChevronRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const SEARCH_HISTORY_KEY = 'fanfic_search_history'

function getHistory(): string[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]') }
  catch { return [] }
}
function addToHistory(q: string) {
  if (typeof window === 'undefined') return
  const updated = [q, ...getHistory().filter(h => h !== q)].slice(0, 5)
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated))
}
function clearHistory() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SEARCH_HISTORY_KEY)
}

interface SearchCounts {
  fanfics: number
  requests: number
  users: number
  collections: number
}

interface SearchBarProps {
  defaultValue?: string
  className?: string
  onSearch?: (query: string) => void
}

function formatCount(n: number): string {
  if (n >= 10000) return '10000+'
  return n.toString()
}

export function SearchBar({ defaultValue = '', className, onSearch }: SearchBarProps) {
  const [value, setValue] = useState(defaultValue)
  const [focused, setFocused] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [counts, setCounts] = useState<SearchCounts | null>(null)
  const [countsLoading, setCountsLoading] = useState(false)
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (focused) setHistory(getHistory())
  }, [focused])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Fetch counts via Next.js route handler (proxies to ficbook.net from Vercel IP — not blocked)
  const fetchCounts = useCallback(async (q: string) => {
    if (!q.trim()) { setCounts(null); return }
    setCountsLoading(true)
    try {
      const res = await fetch('/api/search-counts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })
      if (res.ok) {
        const data = await res.json()
        setCounts(data)
      }
    } catch {
      // silent fail
    } finally {
      setCountsLoading(false)
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setValue(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchCounts(q), 350)
  }

  const doSearch = (q: string, path?: string) => {
    addToHistory(q)
    setHistory(getHistory())
    setFocused(false)
    const target = path || `/search?q=${encodeURIComponent(q)}`
    if (onSearch && !path) { onSearch(q); return }
    router.push(target)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!value.trim()) return
    doSearch(value.trim())
  }

  const showDropdown = focused

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <form onSubmit={handleSubmit}>
        <div className="relative flex items-center">
          <Search size={16} className="absolute left-3 text-zinc-500 pointer-events-none z-10" />
          <input
            ref={inputRef}
            value={value}
            onChange={handleChange}
            onFocus={() => setFocused(true)}
            placeholder="Поиск по сайту"
            className="w-full pl-9 pr-10 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors text-sm"
          />
          {value && (
            <button
              type="button"
              aria-label="Очистить"
              onClick={() => { setValue(''); setCounts(null); inputRef.current?.focus() }}
              className="absolute right-3 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </form>

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 overflow-hidden min-w-[280px]">

          {/* With query: show counts */}
          {value.trim() ? (
            <div className="py-2">
              <div className="px-4 py-1.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-300">Совпадения:</span>
                {countsLoading && <Loader2 size={12} className="animate-spin text-zinc-500" />}
              </div>

              {counts && (
                <div className="space-y-0.5 px-2">
                  {[
                    { label: 'Фанфики', key: 'fanfics' as const, path: `/search?q=${encodeURIComponent(value)}` },
                    { label: 'Заявки', key: 'requests' as const, path: `/search?q=${encodeURIComponent(value)}&type=requests` },
                    { label: 'Пользователи', key: 'users' as const, path: `/search?q=${encodeURIComponent(value)}&type=users` },
                    { label: 'Сборники', key: 'collections' as const, path: `/search?q=${encodeURIComponent(value)}&type=collections` },
                  ].map(({ label, key, path }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => doSearch(value.trim(), path)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors group"
                    >
                      <div className="flex items-center gap-2.5">
                        <Search size={13} className="text-zinc-600" />
                        <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">{label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500 bg-zinc-800 group-hover:bg-zinc-700 px-1.5 py-0.5 rounded transition-colors">
                          {formatCount(counts[key])}
                        </span>
                        <ChevronRight size={13} className="text-zinc-600 group-hover:text-zinc-400" />
                      </div>
                    </button>
                  ))}

                  <div className="border-t border-zinc-800 my-1" />

                  <button
                    type="button"
                    onClick={() => doSearch(value.trim())}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors group"
                  >
                    <Search size={13} className="text-zinc-500" />
                    <span className="text-sm text-zinc-400 group-hover:text-white transition-colors">Все результаты</span>
                  </button>
                </div>
              )}

              {!counts && !countsLoading && (
                <button
                  type="button"
                  onClick={() => doSearch(value.trim())}
                  className="w-full flex items-center gap-2.5 px-5 py-2 hover:bg-zinc-800 transition-colors group"
                >
                  <Search size={13} className="text-zinc-500" />
                  <span className="text-sm text-zinc-400 group-hover:text-white transition-colors">
                    Найти «{value}»
                  </span>
                </button>
              )}
            </div>
          ) : (
            /* Without query: show history + navigation */
            <div className="py-2">
              {/* History */}
              <div className="px-4 py-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-zinc-500 flex items-center gap-1.5">
                    <Clock size={11} /> История поиска
                  </span>
                  {history.length > 0 && (
                    <button
                      type="button"
                      onClick={() => { clearHistory(); setHistory([]) }}
                      className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                    >
                      Очистить
                    </button>
                  )}
                </div>
                {history.length === 0 ? (
                  <p className="text-xs text-zinc-700 py-1">Пусто</p>
                ) : (
                  <div className="space-y-0.5">
                    {history.map((h, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => { setValue(h); fetchCounts(h) }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors text-left"
                      >
                        <Clock size={11} className="text-zinc-600 flex-shrink-0" />
                        <span className="truncate">{h}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-zinc-800 my-1.5" />

              {/* Discover */}
              <div className="px-2 pb-1">
                <p className="text-xs font-semibold text-zinc-500 px-2 mb-1 flex items-center gap-1.5">
                  <Wand2 size={11} /> Испытать удачу
                </p>
                <button
                  type="button"
                  onClick={() => { setFocused(false); router.push('/discover') }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <Shuffle size={13} className="text-zinc-500" />
                    <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">Помоги выбрать</span>
                  </div>
                  <ChevronRight size={13} className="text-zinc-600 group-hover:text-zinc-400" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
