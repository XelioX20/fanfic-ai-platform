'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Clock, Wand2, FileText, Users, Shuffle, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchBarProps {
  defaultValue?: string
  className?: string
  onSearch?: (query: string) => void
}

const SEARCH_HISTORY_KEY = 'fanfic_search_history'

function getHistory(): string[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]')
  } catch {
    return []
  }
}

function addToHistory(query: string) {
  if (typeof window === 'undefined') return
  const history = getHistory().filter(h => h !== query)
  const updated = [query, ...history].slice(0, 5)
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated))
}

function clearHistory() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SEARCH_HISTORY_KEY)
}

export function SearchBar({ defaultValue = '', className, onSearch }: SearchBarProps) {
  const [value, setValue] = useState(defaultValue)
  const [focused, setFocused] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!value.trim()) return
    doSearch(value.trim())
  }

  const doSearch = (q: string) => {
    addToHistory(q)
    setHistory(getHistory())
    setFocused(false)
    if (onSearch) {
      onSearch(q)
    } else {
      router.push(`/search?q=${encodeURIComponent(q)}`)
    }
  }

  const showDropdown = focused && !value.trim()

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <form onSubmit={handleSubmit}>
        <div className="relative flex items-center">
          <Search size={16} className="absolute left-3 text-zinc-500 pointer-events-none z-10" />
          <input
            ref={inputRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder="Поиск по сайту"
            className="w-full pl-9 pr-10 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors text-sm"
          />
          {value && (
            <button
              type="button"
              onClick={() => { setValue(''); inputRef.current?.focus() }}
              className="absolute right-3 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </form>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Search history */}
          <div className="px-3 pt-3 pb-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-zinc-500 flex items-center gap-1.5">
                <Clock size={12} /> История поиска
              </span>
              {history.length > 0 && (
                <button
                  onClick={() => { clearHistory(); setHistory([]) }}
                  className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  Очистить
                </button>
              )}
            </div>
            {history.length === 0 ? (
              <p className="text-xs text-zinc-700 py-1 pb-2">Пусто</p>
            ) : (
              <div className="space-y-0.5 pb-2">
                {history.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => { setValue(h); doSearch(h) }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors text-left"
                  >
                    <Clock size={12} className="text-zinc-600 flex-shrink-0" />
                    <span className="truncate">{h}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-zinc-800" />

          {/* Advanced search */}
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-zinc-500 mb-1.5 flex items-center gap-1.5">
              <Search size={12} /> Расширенный поиск
            </p>
            <div className="space-y-0.5">
              <button
                onClick={() => { setFocused(false); router.push('/search') }}
                className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-zinc-800 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <FileText size={14} className="text-zinc-500" />
                  <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">Фанфиков</span>
                </div>
                <ChevronRight size={14} className="text-zinc-600 group-hover:text-zinc-400" />
              </button>
            </div>
          </div>

          <div className="border-t border-zinc-800" />

          {/* Lucky / Discover */}
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-zinc-500 mb-1.5 flex items-center gap-1.5">
              <Wand2 size={12} /> Испытать удачу
            </p>
            <div className="space-y-0.5 pb-1">
              <button
                onClick={() => { setFocused(false); router.push('/discover') }}
                className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-zinc-800 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <Shuffle size={14} className="text-zinc-500" />
                  <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">Помоги выбрать</span>
                </div>
                <ChevronRight size={14} className="text-zinc-600 group-hover:text-zinc-400" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
