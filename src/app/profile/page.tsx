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
  const history = useReaderStore(s => s.history)
  const clearHistoryEntry = useReaderStore(s => s.clearHistoryEntry)
  const clearAllHistory = useReaderStore(s => s.clearAllHistory)

  const entries = useMemo(() => {
    const arr = Object.values(history) as HistoryEntry[]
    arr.sort((a, b) => b.openedAt - a.openedAt)
    return arr
  }, [history])

  if (entries.length === 0) {
    return (
      <p className="text-center text-zinc-600 py-12 text-sm">
        Пока пусто. Открытые фанфики появятся здесь автоматически.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end mb-2">
        <button
          type="button"
          onClick={() => {
            if (confirm('Очистить всю историю? Это удалит только локальную запись, ficbook не тронется.')) {
              clearAllHistory()
            }
          }}
          className="text-xs text-zinc-500 hover:text-red-400 flex items-center gap-1 transition-colors"
        >
          <Trash2 size={11} /> Очистить историю
        </button>
      </div>
      {entries.map(entry => (
        <div
          key={entry.fanficId}
          className="flex items-start gap-3 p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors group"
        >
          {entry.cover_url ? (
            <Image
              src={entry.cover_url}
              alt=""
              width={40}
              height={56}
              className="rounded object-cover shrink-0 bg-zinc-800"
              unoptimized
            />
          ) : (
            <div className="w-10 h-14 rounded bg-zinc-800 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <Link
              href={`/fanfic/${entry.fanficId}`}
              className="text-sm font-medium text-zinc-100 hover:text-purple-400 line-clamp-2"
            >
              {entry.title}
            </Link>
            <p className="text-xs text-zinc-500 mt-0.5 truncate">{entry.author_name || 'Автор неизвестен'}</p>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-600">
              <span>{relativeTime(entry.openedAt)}</span>
              {entry.direction && <span>· {entry.direction}</span>}
              {entry.rating && <span>· {entry.rating}</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={() => clearHistoryEntry(entry.fanficId)}
            title="Убрать из истории"
            className="p-1.5 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

/* ─── Continue Reading tab (anchors) ──────────────────────────────────── */

function ContinueReadingTab() {
  const anchors = useReaderStore(s => s.anchors)
  const history = useReaderStore(s => s.history)
  const clearAnchor = useReaderStore(s => s.clearAnchor)

  const entries = useMemo(() => {
    const arr = Object.values(anchors) as ReadingAnchor[]
    arr.sort((a, b) => b.updatedAt - a.updatedAt)
    return arr
  }, [anchors])

  if (entries.length === 0) {
    return (
      <div className="text-center text-zinc-500 py-12 space-y-2">
        <p className="text-sm">Нет активных якорей.</p>
        <p className="text-xs text-zinc-600">
          Открой фанфик, нажми <span className="inline-flex items-center gap-1 text-purple-400"><Anchor size={11}/> Якорь</span> в шапке ридера,
          и он появится здесь.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {entries.map(anchor => {
        const histEntry = history[anchor.fanficId]
        // Build the "continue" href — restore-from-anchor via ?anchor=1
        const href = anchor.chapterId === 'single'
          ? `/fanfic/${anchor.fanficId}/read?anchor=1`
          : `/fanfic/${anchor.fanficId}/read/${anchor.chapterId}?anchor=1`
        return (
          <div
            key={anchor.fanficId}
            className="flex items-start gap-3 p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg hover:border-purple-700/40 transition-colors group"
          >
            {histEntry?.cover_url ? (
              <Image
                src={histEntry.cover_url}
                alt=""
                width={40}
                height={56}
                className="rounded object-cover shrink-0 bg-zinc-800"
                unoptimized
              />
            ) : (
              <div className="w-10 h-14 rounded bg-zinc-800 shrink-0 flex items-center justify-center">
                <Anchor size={14} className="text-zinc-600" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <Link
                href={`/fanfic/${anchor.fanficId}`}
                className="text-sm font-medium text-zinc-100 hover:text-purple-400 line-clamp-2"
              >
                {histEntry?.title || `Фанфик ${anchor.fanficId.slice(0, 8)}…`}
              </Link>
              {anchor.chapterTitle && (
                <p className="text-xs text-purple-300/80 mt-0.5 truncate">
                  ⚑ {anchor.chapterTitle}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-600">
                <span>{relativeTime(anchor.updatedAt)}</span>
              </div>
              <Link
                href={href}
                className="inline-flex items-center gap-1 mt-2 text-xs text-purple-400 hover:text-purple-300"
              >
                <Anchor size={11} /> Продолжить →
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
              className="p-1.5 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
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
