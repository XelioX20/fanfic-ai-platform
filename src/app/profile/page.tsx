'use client'
import { useEffect, useMemo, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import {
  User, Heart, Clock, Anchor, Settings, ExternalLink, Loader2, Trash2, X, Bookmark, LogOut,
} from 'lucide-react'
import { useAuthStore, useReaderStore, type HistoryEntry, type ReadingAnchor, type BookmarkEntry } from '@/store'
import { profileApi, authApi } from '@/lib/api'
import { FanficGrid } from '@/components/fanfic/FanficGrid'
import { cn } from '@/lib/utils'
import { FONT_OPTIONS, getFontCssVar } from '@/lib/fonts'
import type { Fanfic } from '@/types'

type Tab = 'continue' | 'favourites' | 'history' | 'settings'

const TABS: { id: Tab; label: string; shortLabel: string; icon: React.ReactNode }[] = [
  { id: 'continue',   label: 'Продолжить чтение', shortLabel: 'Читаю',    icon: <Anchor size={22} /> },
  { id: 'favourites', label: 'Избранное',         shortLabel: 'Избранное', icon: <Heart size={22} /> },
  { id: 'history',    label: 'История',           shortLabel: 'История',   icon: <Clock size={22} /> },
  { id: 'settings',   label: 'Читалка',           shortLabel: 'Читалка',   icon: <Settings size={22} /> },
]

/* ─── ficbook-backed sections (Избранное) ────────────────────────────── */

function FanficSection({ fetcher }: { fetcher: (page: number) => Promise<{ data: { items: Fanfic[]; has_next: boolean } }> }) {
  const [fanfics, setFanfics] = useState<Fanfic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasNext, setHasNext] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetcher(page)
      .then(r => {
        setFanfics(r.data.items || [])
        setHasNext(r.data.has_next || false)
      })
      .catch(e => setError(e?.response?.data?.detail || 'Ошибка загрузки'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  if (error) return (
    <div className="py-8 text-center text-zinc-500 text-sm">
      {error.toLowerCase().includes('log in') || error.includes('401') || error.includes('403')
        ? 'Для просмотра нужно войти через форму логина ficbook.net.'
        : error}
    </div>
  )

  return (
    <div>
      <FanficGrid fanfics={fanfics} loading={loading} />
      {!loading && fanfics.length === 0 && (
        <p className="text-center text-zinc-600 py-12 text-sm">Пусто</p>
      )}
      {(page > 1 || hasNext) && !loading && (
        <div className="flex justify-center gap-3 mt-6">
          <button
            onClick={() => setPage(p => p - 1)}
            disabled={page === 1}
            className="px-4 py-2 text-sm bg-zinc-800 text-zinc-300 rounded-lg disabled:opacity-30 hover:bg-zinc-700 transition-colors"
          >
            Назад
          </button>
          <span className="px-4 py-2 text-sm text-zinc-500">{page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={!hasNext}
            className="px-4 py-2 text-sm bg-zinc-800 text-zinc-300 rounded-lg disabled:opacity-30 hover:bg-zinc-700 transition-colors"
          >
            Далее
          </button>
        </div>
      )}
    </div>
  )
}

/* ─── Local History (from useReaderStore.history) ─────────────────────── */

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'только что'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} мин назад`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} ч назад`
  const days = Math.floor(diff / 86400_000)
  if (days < 30) return `${days} дн назад`
  return new Date(ts).toLocaleDateString('ru-RU')
}

/* ─── Local bookmarks (heart / bookmark FAB target) ───────────────────── */

function LocalBookmarksTab() {
  const bookmarks = useReaderStore(s => s.bookmarks ?? {})
  const removeBookmark = useReaderStore(s => s.removeBookmark)

  const entries = useMemo(() => {
    const arr = Object.values(bookmarks) as BookmarkEntry[]
    arr.sort((a, b) => b.addedAt - a.addedAt)
    return arr
  }, [bookmarks])

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 py-14 px-6 text-center">
        <Bookmark size={28} className="mx-auto text-zinc-700 mb-3" />
        <p className="text-zinc-300 text-base font-medium">В избранном пока пусто</p>
        <p className="text-sm text-zinc-500 mt-2 max-w-sm mx-auto">
          Открой фанфик и нажми{' '}
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-pink-950/50 text-pink-300 border border-pink-800/50 text-[10px] font-medium">
            <Bookmark size={10} /> В избранное
          </span>
          {' '}или{' '}
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-pink-950/50 text-pink-300 border border-pink-800/50 text-[10px] font-medium">
            <Heart size={10} /> ♥
          </span>
          {' '}— он появится здесь и синхронизируется между устройствами.
        </p>
      </div>
    )
  }

  return (
    <div>
      <p className="text-sm sm:text-base text-zinc-500 mb-4">
        <span className="text-zinc-300 font-medium">{entries.length}</span>{' '}
        {entries.length === 1 ? 'фанфик в избранном' : 'фанфиков в избранном'}
        {' · '}
        <span className="text-zinc-600">синхронизировано между устройствами</span>
      </p>

      <ul className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        {entries.map(entry => (
          <li key={entry.fanficId} className="relative group">
            <Link
              href={`/fanfic/${entry.fanficId}`}
              className={cn(
                'flex gap-3 p-3 rounded-xl border',
                'border-rose-900/40 bg-rose-950/20',
                'hover:border-rose-700/50 hover:bg-rose-950/30 transition-all',
              )}
            >
              {entry.cover_url ? (
                <Image
                  src={entry.cover_url}
                  alt=""
                  width={56}
                  height={80}
                  className="rounded-md object-cover shrink-0 bg-zinc-800 shadow-sm shadow-black/40"
                  unoptimized
                />
              ) : (
                <div className="w-14 h-20 rounded-md bg-zinc-800 shrink-0 flex items-center justify-center">
                  <Bookmark size={16} className="text-pink-500/50" />
                </div>
              )}
              <div className="flex-1 min-w-0 pr-6">
                <h3 className="text-sm sm:text-base font-semibold text-zinc-100 line-clamp-2 leading-snug">
                  {entry.title || `Фанфик ${entry.fanficId.slice(0, 8)}…`}
                </h3>
                <p className="text-xs sm:text-sm text-zinc-500 mt-1 truncate">
                  {entry.author_name || 'Автор неизвестен'}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {entry.direction && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60">{entry.direction}</span>
                  )}
                  {entry.rating && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60">{entry.rating}</span>
                  )}
                  {entry.completion_status && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60">{entry.completion_status}</span>
                  )}
                </div>
                <p className="text-xs text-zinc-600 mt-2 flex items-center gap-1">
                  <Bookmark size={10} /> добавлено {relativeTime(entry.addedAt)}
                </p>
              </div>
            </Link>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeBookmark(entry.fanficId) }}
              title="Убрать из избранного"
              className={cn(
                'absolute top-2 right-2 p-1.5 rounded-md bg-white/10 text-white/60',
                'hover:text-red-400 hover:bg-red-900/40 transition-all',
                'sm:opacity-0 sm:group-hover:opacity-100',
              )}
            >
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function LocalHistoryTab() {
  const history = useReaderStore(s => s.history ?? {})
  const clearHistoryEntry = useReaderStore(s => s.clearHistoryEntry)
  const clearAllHistory = useReaderStore(s => s.clearAllHistory)

  const entries = useMemo(() => {
    const arr = Object.values(history) as HistoryEntry[]
    arr.sort((a, b) => b.openedAt - a.openedAt)
    return arr
  }, [history])

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 py-14 px-6 text-center">
        <Clock size={28} className="mx-auto text-zinc-700 mb-3" />
        <p className="text-zinc-300 text-base font-medium">История пока пуста</p>
        <p className="text-xs sm:text-sm text-zinc-500 mt-1">
          Открытые фанфики появляются здесь автоматически. Синхронизируется между устройствами.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-zinc-500">
          <span className="text-zinc-300 font-medium">{entries.length}</span> {entries.length === 1 ? 'фанфик' : 'фанфиков'}
        </p>
        <button
          type="button"
          onClick={() => {
            if (confirm('Очистить всю историю? Локальная запись + запись на сервере будут удалены.')) {
              clearAllHistory()
            }
          }}
          className="text-sm text-zinc-500 hover:text-red-400 flex items-center gap-1 transition-colors"
        >
          <Trash2 size={12} /> Очистить историю
        </button>
      </div>

      <ul className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        {entries.map(entry => (
          <li key={entry.fanficId} className="relative group">
            <Link
              href={`/fanfic/${entry.fanficId}`}
              className={cn(
                'flex gap-3 p-3 rounded-xl border border-amber-900/35 bg-amber-950/15',
                'hover:border-amber-700/50 hover:bg-amber-950/25 transition-all',
              )}
            >
              {entry.cover_url ? (
                <Image
                  src={entry.cover_url}
                  alt=""
                  width={56}
                  height={80}
                  className="rounded-md object-cover shrink-0 bg-zinc-800 shadow-sm shadow-black/40"
                  unoptimized
                />
              ) : (
                <div className="w-14 h-20 rounded-md bg-zinc-800 shrink-0" />
              )}
              <div className="flex-1 min-w-0 pr-6">
                <h3 className="text-sm sm:text-base font-semibold text-zinc-100 line-clamp-2 leading-snug">
                  {entry.title}
                </h3>
                <p className="text-xs sm:text-sm text-zinc-500 mt-1 truncate">
                  {entry.author_name || 'Автор неизвестен'}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {entry.direction && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                      {entry.direction}
                    </span>
                  )}
                  {entry.rating && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                      {entry.rating}
                    </span>
                  )}
                  {entry.completion_status && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                      {entry.completion_status}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-600 mt-2 flex items-center gap-1">
                  <Clock size={10} /> {relativeTime(entry.openedAt)}
                </p>
              </div>
            </Link>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); clearHistoryEntry(entry.fanficId) }}
              title="Убрать из истории"
              className={cn(
                'absolute top-2 right-2 p-1.5 rounded-md bg-white/10 text-white/60',
                'hover:text-red-400 hover:bg-red-900/40 transition-all',
                'sm:opacity-0 sm:group-hover:opacity-100',
              )}
            >
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ─── Continue Reading tab (anchors) ──────────────────────────────────── */

function ContinueReadingTab() {
  const anchors = useReaderStore(s => s.anchors ?? {})
  const history = useReaderStore(s => s.history ?? {})
  const clearAnchor = useReaderStore(s => s.clearAnchor)

  const entries = useMemo(() => {
    const arr = Object.values(anchors) as ReadingAnchor[]
    arr.sort((a, b) => b.updatedAt - a.updatedAt)
    return arr
  }, [anchors])

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 py-14 px-6 text-center">
        <Anchor size={28} className="mx-auto text-zinc-700 mb-3" />
        <p className="text-zinc-300 text-base font-medium">Ещё нет активных якорей</p>
        <p className="text-sm text-zinc-500 mt-2 max-w-sm mx-auto">
          Открой фанфик, нажми кнопку{' '}
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-950/50 text-purple-300 border border-purple-800/50 text-[10px] font-medium">
            <Anchor size={10} /> Поставить якорь
          </span>{' '}
          в правом нижнем углу — и он появится здесь на всех твоих устройствах.
        </p>
      </div>
    )
  }

  return (
    <div>
      <p className="text-sm sm:text-base text-zinc-500 mb-4">
        <span className="text-zinc-300 font-medium">{entries.length}</span> {entries.length === 1 ? 'фанфик с якорем' : 'фанфиков с якорями'}
        {' · '}
        <span className="text-zinc-600">синхронизировано между устройствами</span>
      </p>

      <ul className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        {entries.map(anchor => {
          const histEntry = history[anchor.fanficId]
          const continueHref = anchor.chapterId === 'single'
            ? `/fanfic/${anchor.fanficId}/read?anchor=1`
            : `/fanfic/${anchor.fanficId}/read/${anchor.chapterId}?anchor=1`
          return (
            <li key={anchor.fanficId} className="relative group">
              <div className={cn(
                'flex flex-col gap-3 p-3 rounded-xl border transition-all',
                'border-indigo-900/40 bg-indigo-950/20',
                'hover:border-indigo-700/50 hover:bg-indigo-950/30',
              )}>
                <div className="flex gap-3">
                  {histEntry?.cover_url ? (
                    <Image
                      src={histEntry.cover_url}
                      alt=""
                      width={56}
                      height={80}
                      className="rounded-md object-cover shrink-0 bg-zinc-800 shadow-sm shadow-black/40"
                      unoptimized
                    />
                  ) : (
                    <div className="w-14 h-20 rounded-md bg-zinc-800 shrink-0 flex items-center justify-center">
                      <Anchor size={16} className="text-purple-500/50" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 pr-7">
                    <Link
                      href={`/fanfic/${anchor.fanficId}`}
                      className="text-base font-semibold text-zinc-50 line-clamp-2 leading-snug hover:text-purple-300 transition-colors"
                    >
                      {histEntry?.title || `Фанфик ${anchor.fanficId.slice(0, 8)}…`}
                    </Link>
                    {histEntry?.author_name && (
                      <p className="text-sm text-zinc-300 mt-1 truncate">{histEntry.author_name}</p>
                    )}
                    {anchor.chapterTitle && (
                      <p className="text-xs text-purple-200 mt-1.5 flex items-center gap-1">
                        <Anchor size={10} className="fill-purple-300/60" />
                        <span className="truncate">{anchor.chapterTitle}</span>
                      </p>
                    )}
                    <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
                      <Clock size={11} /> {relativeTime(anchor.updatedAt)}
                    </p>
                  </div>
                </div>

                <Link
                  href={continueHref}
                  className={cn(
                    'flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all',
                    'bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white',
                    'hover:from-indigo-400 hover:to-fuchsia-400',
                    'shadow-md shadow-fuchsia-900/40',
                  )}
                >
                  <Anchor size={14} /> Продолжить с якоря →
                </Link>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (confirm('Убрать якорь для этого фанфика?')) {
                    clearAnchor(anchor.fanficId)
                  }
                }}
                title="Убрать якорь"
                className={cn(
                  'absolute top-2 right-2 p-1.5 rounded-md transition-all',
                  'bg-white/10 text-white/70',
                  'hover:text-red-300 hover:bg-red-900/50',
                )}
              >
                <X size={16} />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* ─── Reader settings tab ─────────────────────────────────────────────── */

function ReaderSettingsTab() {
  const { settings, updateSettings } = useReaderStore()

  // Preset text colours: null = theme default, others are custom overrides.
  const TEXT_COLOR_PRESETS = [
    { label: 'По теме',   value: null,      swatch: null },
    { label: 'Белый',     value: '#f4f4f5', swatch: '#f4f4f5' },
    { label: 'Светло-серый', value: '#d4d4d8', swatch: '#d4d4d8' },
    { label: 'Жёлтый',   value: '#fef3c7', swatch: '#fef3c7' },
    { label: 'Кремовый',  value: '#fdf4e3', swatch: '#fdf4e3' },
    { label: 'Тёмный',    value: '#1a1a1a', swatch: '#1a1a1a' },
  ] as const

  const activeColor = settings.custom_text_color ?? null

  return (
    <div className="max-w-md space-y-6">
      {/* Font size */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm text-zinc-400">Размер шрифта</label>
          <span className="text-sm font-medium text-zinc-200 tabular-nums">{settings.font_size}px</span>
        </div>
        <input type="range" min="12" max="26" step="1" value={settings.font_size}
          title="Размер шрифта"
          onChange={e => updateSettings({ font_size: Number(e.target.value) })} className="w-full" />
        <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
          <span>12px</span><span>26px</span>
        </div>
      </div>

      {/* Line height */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm text-zinc-400">Межстрочный интервал</label>
          <span className="text-sm font-medium text-zinc-200 tabular-nums">{settings.line_height.toFixed(1)}</span>
        </div>
        <input type="range" min="1.2" max="2.5" step="0.1" value={settings.line_height}
          title="Межстрочный интервал"
          onChange={e => updateSettings({ line_height: Number(e.target.value) })} className="w-full" />
        <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
          <span>тесно</span><span>просторно</span>
        </div>
      </div>

      {/* Column width */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm text-zinc-400">Ширина колонки</label>
          <span className="text-sm font-medium text-zinc-200 tabular-nums">{settings.max_width}px</span>
        </div>
        <input type="range" min="480" max="900" step="20" value={settings.max_width}
          title="Ширина колонки"
          onChange={e => updateSettings({ max_width: Number(e.target.value) })} className="w-full" />
        <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
          <span>узкая</span><span>широкая</span>
        </div>
      </div>

      {/* Text colour */}
      <div>
        <label className="text-sm text-zinc-400 block mb-2">Цвет текста</label>
        <div className="flex flex-wrap gap-2">
          {TEXT_COLOR_PRESETS.map(preset => (
            <button
              key={preset.label}
              type="button"
              onClick={() => updateSettings({ custom_text_color: preset.value as string | null })}
              title={preset.label}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all',
                activeColor === preset.value
                  ? 'border-purple-500 bg-purple-500/10 text-zinc-100'
                  : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200',
              )}
            >
              {preset.swatch ? (
                <span
                  className="inline-block w-3 h-3 rounded-full border border-zinc-600 shrink-0"
                  style={{ backgroundColor: preset.swatch }}
                />
              ) : (
                <span className="inline-block w-3 h-3 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 shrink-0" />
              )}
              {preset.label}
            </button>
          ))}
          {/* Custom hex input */}
          <label className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all',
            activeColor && !TEXT_COLOR_PRESETS.some(p => p.value === activeColor)
              ? 'border-purple-500 bg-purple-500/10 text-zinc-100'
              : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200',
          )}>
            <span>Свой цвет</span>
            <input
              type="color"
              value={activeColor ?? '#d4d4d8'}
              onChange={e => updateSettings({ custom_text_color: e.target.value })}
              className="sr-only"
            />
          </label>
        </div>
        {activeColor && (
          <button
            type="button"
            onClick={() => updateSettings({ custom_text_color: null })}
            className="mt-2 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ↩ Сбросить к цвету темы
          </button>
        )}
      </div>

      {/* Font picker */}
      <div>
        <label className="text-sm text-zinc-400 block mb-3">Шрифт</label>

        <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">С засечками — для художественного чтения</p>
        <div className="grid grid-cols-2 gap-1.5 mb-4">
          {FONT_OPTIONS.filter(f => f.category === 'serif').map(f => (
            <button
              key={f.value}
              type="button"
              onClick={() => updateSettings({ font_family: f.value })}
              style={{ fontFamily: getFontCssVar(f.value) }}
              className={cn(
                'px-3 py-2 rounded-lg border transition-all text-left group',
                settings.font_family === f.value
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-zinc-700 hover:border-zinc-500',
              )}
            >
              <span className={cn('text-sm block', settings.font_family === f.value ? 'text-zinc-100' : 'text-zinc-300')}>
                {f.label}
              </span>
              <span className="text-[10px] text-zinc-600">{f.hint}</span>
            </button>
          ))}
        </div>

        <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Без засечек — современный стиль</p>
        <div className="grid grid-cols-2 gap-1.5">
          {FONT_OPTIONS.filter(f => f.category === 'sans').map(f => (
            <button
              key={f.value}
              type="button"
              onClick={() => updateSettings({ font_family: f.value })}
              style={{ fontFamily: getFontCssVar(f.value) }}
              className={cn(
                'px-3 py-2 rounded-lg border transition-all text-left',
                settings.font_family === f.value
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-zinc-700 hover:border-zinc-500',
              )}
            >
              <span className={cn('text-sm block', settings.font_family === f.value ? 'text-zinc-100' : 'text-zinc-300')}>
                {f.label}
              </span>
              <span className="text-[10px] text-zinc-600">{f.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Page ────────────────────────────────────────────────────────────── */

function ProfileContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, accessToken, clearAuth } = useAuthStore()
  const [activeTab, setActiveTab] = useState<Tab>((searchParams.get('tab') as Tab) || 'continue')

  const handleLogout = async () => {
    try { await authApi.logout() } catch {}
    clearAuth()
    router.push('/')
  }
  const [profileData, setProfileData] = useState<{
    ficbook_username?: string
    ficbook_avatar_url?: string
    custom_avatar_url?: string
    avatar_url?: string
    ficbook_profile_url?: string
  } | null>(null)

  useEffect(() => {
    if (!accessToken) {
      router.push('/login')
      return
    }
    profileApi.me().then(r => setProfileData(r.data)).catch(() => {})
  }, [accessToken, router])

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab)
    router.replace(`/profile?tab=${tab}`, { scroll: false })
  }

  const displayName = profileData?.ficbook_username || user?.ficbook_username || 'Пользователь'
  // Effective avatar: custom upload > ficbook > placeholder
  const avatarUrl = profileData?.avatar_url || profileData?.ficbook_avatar_url || user?.ficbook_avatar_url || null
  const [avatarUploading, setAvatarUploading] = useState(false)

  // Counts shown as badges on tab items
  const anchorsCount = Object.keys(useReaderStore(s => s.anchors ?? {})).length
  const bookmarksCount = Object.keys(useReaderStore(s => s.bookmarks ?? {})).length
  const historyCount = Object.keys(useReaderStore(s => s.history ?? {})).length
  const tabCounts: Partial<Record<Tab, number>> = {
    continue: anchorsCount,
    favourites: bookmarksCount,
    history: historyCount,
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 512 * 1024) {
      alert('Фото слишком большое — максимум 512 КБ. Пожалуйста, сожми изображение.')
      return
    }
    setAvatarUploading(true)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      await profileApi.updateAvatar(base64)
      // Refresh profile data to show the new avatar immediately
      const r = await profileApi.me()
      setProfileData(r.data)
    } catch {
      alert('Не удалось загрузить фото. Попробуй снова.')
    } finally {
      setAvatarUploading(false)
      e.target.value = ''
    }
  }

  return (
    <>
      {/* ── Main: responsive two-column on desktop, stacked on mobile ── */}
      <main className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-8 md:flex md:gap-6">

        {/* ── LEFT SIDEBAR (desktop only) ─────────────────────────────── */}
        <aside className="hidden md:flex md:flex-col md:w-56 md:shrink-0">
          {/* Profile card */}
          <div className="mb-6 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
            {/* Avatar */}
            <label className="relative cursor-pointer group block w-fit mb-3" title="Нажми чтобы изменить фото">
              <input type="file" accept="image/*" className="sr-only"
                onChange={handleAvatarChange} disabled={avatarUploading} />
              {avatarUrl ? (
                <Image src={avatarUrl} alt={displayName} width={64} height={64}
                  className="rounded-full object-cover ring-2 ring-transparent group-hover:ring-purple-500 transition-all" unoptimized />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-700 to-purple-900 flex items-center justify-center ring-2 ring-transparent group-hover:ring-purple-500 transition-all">
                  <User size={28} className="text-white" />
                </div>
              )}
              <div className={cn('absolute inset-0 rounded-full bg-black/50 flex items-center justify-center transition-opacity',
                avatarUploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>
                {avatarUploading ? <Loader2 size={16} className="text-white animate-spin" />
                  : <span className="text-white text-[9px] font-medium text-center leading-tight px-1">Сменить</span>}
              </div>
            </label>
            <p className="font-semibold text-zinc-100 text-sm truncate">{displayName}</p>
            {profileData?.ficbook_profile_url && (
              <a href={profileData.ficbook_profile_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-purple-400 transition-colors mt-0.5">
                <ExternalLink size={10} /> ficbook.net
              </a>
            )}
            {profileData?.custom_avatar_url && (
              <button type="button" onClick={async () => {
                try { await profileApi.deleteAvatar(); const r = await profileApi.me(); setProfileData(r.data) } catch {}
              }} className="text-[10px] text-zinc-600 hover:text-red-400 mt-1 transition-colors block">
                Удалить своё фото
              </button>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 mt-3 text-xs text-zinc-500 hover:text-red-400 transition-colors"
            >
              <LogOut size={13} /> Выйти
            </button>
          </div>

          {/* Nav items */}
          <nav className="flex flex-col gap-1">
            {TABS.map(tab => {
              const count = tabCounts[tab.id]
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left w-full',
                    activeTab === tab.id
                      ? 'bg-purple-600/20 text-purple-300 border border-purple-600/30'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 border border-transparent',
                  )}
                >
                  <span className={cn('shrink-0', activeTab === tab.id ? 'text-purple-400' : '')}>
                    {tab.icon}
                  </span>
                  <span className="flex-1 truncate">{tab.label}</span>
                  {count != null && count > 0 && (
                    <span className={cn(
                      'text-[11px] font-medium px-1.5 py-0.5 rounded-full min-w-[20px] text-center tabular-nums',
                      activeTab === tab.id
                        ? 'bg-purple-600/30 text-purple-200'
                        : 'bg-zinc-700/60 text-zinc-400',
                    )}>
                      {count > 999 ? '999+' : count}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </aside>

        {/* ── CONTENT AREA ────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {/* Mobile: compact profile header */}
          <div className="flex items-center gap-3 mb-5 md:hidden">
            <label className="relative cursor-pointer group shrink-0" title="Изменить фото">
              <input type="file" accept="image/*" className="sr-only"
                onChange={handleAvatarChange} disabled={avatarUploading} />
              {avatarUrl ? (
                <Image src={avatarUrl} alt={displayName} width={48} height={48}
                  className="rounded-full object-cover ring-2 ring-transparent group-hover:ring-purple-500 transition-all" unoptimized />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-700 to-purple-900 flex items-center justify-center">
                  <User size={20} className="text-white" />
                </div>
              )}
              <div className={cn('absolute inset-0 rounded-full bg-black/50 flex items-center justify-center transition-opacity',
                avatarUploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>
                {avatarUploading ? <Loader2 size={14} className="text-white animate-spin" /> : <span className="text-[8px] text-white">✏</span>}
              </div>
            </label>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-zinc-100 text-sm truncate">{displayName}</p>
              {profileData?.ficbook_profile_url && (
                <a href={profileData.ficbook_profile_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-purple-400 transition-colors">
                  <ExternalLink size={10} /> ficbook.net
                </a>
              )}
            </div>
            {/* Logout — top-right of mobile header */}
            <button
              type="button"
              onClick={handleLogout}
              title="Выйти"
              aria-label="Выйти"
              className="shrink-0 p-2 text-zinc-500 hover:text-red-400 transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>

          {/* Tab content */}
          {activeTab === 'continue' && <ContinueReadingTab />}
          {activeTab === 'favourites' && <LocalBookmarksTab />}
          {activeTab === 'history' && <LocalHistoryTab />}
          {activeTab === 'settings' && <ReaderSettingsTab />}
        </div>
      </main>

      {/* ── BOTTOM TAB BAR (mobile only, fixed) ─────────────────────── */}
      <nav className={cn(
        'fixed bottom-0 inset-x-0 z-40 md:hidden',
        'bg-zinc-900/95 backdrop-blur border-t border-zinc-800',
        'safe-area-inset-bottom', // respects iOS home indicator
      )}>
        <div className="flex items-stretch h-16">
          {TABS.map(tab => {
            const count = tabCounts[tab.id]
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors relative',
                  active ? 'text-purple-400' : 'text-zinc-500',
                )}
              >
                {/* Badge */}
                {count != null && count > 0 && (
                  <span className="absolute top-2 right-[calc(50%-12px)] -translate-x-[4px] bg-purple-600 text-white text-[9px] font-bold px-1 rounded-full min-w-[16px] h-[16px] flex items-center justify-center tabular-nums leading-none">
                    {count > 99 ? '99+' : count}
                  </span>
                )}
                <span className={cn('transition-transform', active && 'scale-110')}>
                  {tab.icon}
                </span>
                <span className="text-[11px] xs:text-xs sm:text-xs font-medium leading-tight">{tab.shortLabel}</span>
                {active && (
                  <span className="absolute top-0 inset-x-0 h-0.5 bg-purple-500 rounded-b" />
                )}
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950 flex items-center justify-center"><Loader2 className="animate-spin text-zinc-600" /></div>}>
      <ProfileContent />
    </Suspense>
  )
}
