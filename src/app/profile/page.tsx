'use client'
import { useEffect, useMemo, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import {
  User, Heart, Clock, Anchor, Settings, ExternalLink, Loader2, Trash2, X,
} from 'lucide-react'
import { useAuthStore, useReaderStore, type HistoryEntry, type ReadingAnchor } from '@/store'
import { profileApi } from '@/lib/api'
import { FanficGrid } from '@/components/fanfic/FanficGrid'
import { cn } from '@/lib/utils'
import { FONT_OPTIONS, getFontCssVar } from '@/lib/fonts'
import type { Fanfic } from '@/types'

type Tab = 'profile' | 'favourites' | 'history' | 'continue' | 'settings'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'profile',    label: 'Профиль',            icon: <User size={15} /> },
  { id: 'favourites', label: 'Избранное',          icon: <Heart size={15} /> },
  { id: 'history',    label: 'История',            icon: <Clock size={15} /> },
  { id: 'continue',   label: 'Продолжить чтение',  icon: <Anchor size={15} /> },
  { id: 'settings',   label: 'Читалка',            icon: <Settings size={15} /> },
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
        <p className="text-zinc-300 text-sm font-medium">История пока пуста</p>
        <p className="text-xs text-zinc-500 mt-1">
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
          className="text-xs text-zinc-500 hover:text-red-400 flex items-center gap-1 transition-colors"
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
                'flex gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-900/60',
                'hover:border-purple-700/50 hover:bg-zinc-900 transition-all',
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
                <h3 className="text-sm font-semibold text-zinc-100 line-clamp-2 leading-snug">
                  {entry.title}
                </h3>
                <p className="text-xs text-zinc-500 mt-1 truncate">
                  {entry.author_name || 'Автор неизвестен'}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {entry.direction && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                      {entry.direction}
                    </span>
                  )}
                  {entry.rating && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                      {entry.rating}
                    </span>
                  )}
                  {entry.completion_status && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                      {entry.completion_status}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-600 mt-2 flex items-center gap-1">
                  <Clock size={10} /> {relativeTime(entry.openedAt)}
                </p>
              </div>
            </Link>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); clearHistoryEntry(entry.fanficId) }}
              title="Убрать из истории"
              className={cn(
                'absolute top-2 right-2 p-1.5 rounded-md bg-zinc-900/80 text-zinc-500',
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
        <p className="text-zinc-300 text-sm font-medium">Ещё нет активных якорей</p>
        <p className="text-xs text-zinc-500 mt-2 max-w-sm mx-auto">
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
      <p className="text-sm text-zinc-500 mb-4">
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
                'border-purple-800/40 bg-gradient-to-br from-purple-950/25 via-zinc-900/70 to-zinc-900/60',
                'hover:border-purple-600/60 hover:from-purple-900/30',
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
                  <div className="flex-1 min-w-0 pr-6">
                    <Link
                      href={`/fanfic/${anchor.fanficId}`}
                      className="text-sm font-semibold text-zinc-100 line-clamp-2 leading-snug hover:text-purple-300 transition-colors"
                    >
                      {histEntry?.title || `Фанфик ${anchor.fanficId.slice(0, 8)}…`}
                    </Link>
                    {histEntry?.author_name && (
                      <p className="text-xs text-zinc-500 mt-1 truncate">{histEntry.author_name}</p>
                    )}
                    {anchor.chapterTitle && (
                      <p className="text-xs text-purple-300 mt-1.5 flex items-center gap-1">
                        <Anchor size={10} className="fill-purple-400/40" />
                        <span className="truncate">{anchor.chapterTitle}</span>
                      </p>
                    )}
                    <p className="text-[11px] text-zinc-600 mt-1 flex items-center gap-1">
                      <Clock size={10} /> {relativeTime(anchor.updatedAt)}
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
                  'absolute top-2 right-2 p-1.5 rounded-md bg-zinc-900/80 text-zinc-400',
                  'hover:text-red-400 hover:bg-red-900/40 transition-all',
                  'sm:opacity-0 sm:group-hover:opacity-100',
                )}
              >
                <X size={14} />
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
  return (
    <div className="max-w-sm space-y-5">
      <div>
        <label className="text-sm text-zinc-400 block mb-2">Размер шрифта: {settings.font_size}px</label>
        <input type="range" min="12" max="24" step="1" value={settings.font_size}
          onChange={e => updateSettings({ font_size: Number(e.target.value) })} className="w-full" />
      </div>
      <div>
        <label className="text-sm text-zinc-400 block mb-2">Межстрочный интервал: {settings.line_height}</label>
        <input type="range" min="1.2" max="2.5" step="0.1" value={settings.line_height}
          onChange={e => updateSettings({ line_height: Number(e.target.value) })} className="w-full" />
      </div>
      <div>
        <label className="text-sm text-zinc-400 block mb-2">Ширина колонки: {settings.max_width}px</label>
        <input type="range" min="500" max="900" step="20" value={settings.max_width}
          onChange={e => updateSettings({ max_width: Number(e.target.value) })} className="w-full" />
      </div>
      <div>
        <label className="text-sm text-zinc-400 block mb-2">Шрифт</label>

        <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">С засечками (для книг)</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-3">
          {FONT_OPTIONS.filter(f => f.category === 'serif').map(f => (
            <button
              key={f.value}
              type="button"
              onClick={() => updateSettings({ font_family: f.value })}
              style={{ fontFamily: getFontCssVar(f.value) }}
              className={cn(
                'px-2 py-1.5 text-sm rounded border transition-all text-left',
                settings.font_family === f.value
                  ? 'border-purple-500 bg-purple-500/10 text-zinc-100'
                  : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Без засечек (современные)</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {FONT_OPTIONS.filter(f => f.category === 'sans').map(f => (
            <button
              key={f.value}
              type="button"
              onClick={() => updateSettings({ font_family: f.value })}
              style={{ fontFamily: getFontCssVar(f.value) }}
              className={cn(
                'px-2 py-1.5 text-sm rounded border transition-all text-left',
                settings.font_family === f.value
                  ? 'border-purple-500 bg-purple-500/10 text-zinc-100'
                  : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
              )}
            >
              {f.label}
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
  const { user, accessToken } = useAuthStore()
  const [activeTab, setActiveTab] = useState<Tab>((searchParams.get('tab') as Tab) || 'profile')
  const [profileData, setProfileData] = useState<{ ficbook_username?: string; ficbook_avatar_url?: string; ficbook_profile_url?: string } | null>(null)

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
  const avatarUrl = profileData?.ficbook_avatar_url || user?.ficbook_avatar_url

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      {/* Profile header */}
      <div className="flex items-center gap-4 mb-8">
        {avatarUrl ? (
          <Image src={avatarUrl} alt={displayName} width={64} height={64}
            className="rounded-full object-cover" unoptimized />
        ) : (
          <div className="w-16 h-16 rounded-full bg-purple-800 flex items-center justify-center">
            <User size={28} className="text-white" />
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold text-zinc-100">{displayName}</h1>
          {profileData?.ficbook_profile_url && (
            <a href={profileData.ficbook_profile_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-zinc-500 hover:text-purple-400 transition-colors mt-0.5">
              <ExternalLink size={12} /> Профиль на ficbook.net
            </a>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-zinc-800 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.id} type="button" onClick={() => handleTabChange(tab.id)}
            className={cn('flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px',
              activeTab === tab.id
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            )}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'profile' && (
        <div className="space-y-3 text-sm text-zinc-400">
          <div className="flex gap-2"><span className="text-zinc-600 w-32">Имя:</span><span>{displayName}</span></div>
          {profileData?.ficbook_profile_url && (
            <div className="flex gap-2">
              <span className="text-zinc-600 w-32">ficbook.net:</span>
              <a href={profileData.ficbook_profile_url} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">Открыть профиль</a>
            </div>
          )}
        </div>
      )}
      {activeTab === 'favourites' && <FanficSection fetcher={profileApi.favourites} />}
      {activeTab === 'history' && <LocalHistoryTab />}
      {activeTab === 'continue' && <ContinueReadingTab />}
      {activeTab === 'settings' && <ReaderSettingsTab />}
    </main>
  )
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950 flex items-center justify-center"><Loader2 className="animate-spin text-zinc-600" /></div>}>
      <ProfileContent />
    </Suspense>
  )
}
