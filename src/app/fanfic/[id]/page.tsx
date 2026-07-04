'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Heart, Trophy, MessageSquare, BookOpen, ArrowLeft, BookMarked, Anchor,
  Bell, BellOff, FolderPlus, Download, Loader2, Flame, ChevronDown, ChevronUp,
} from 'lucide-react'
import { useAuthStore, useReaderStore } from '@/store'
import { cn, formatNumber, formatWordCount } from '@/lib/utils'
import { Loader } from '@/components/ui/Loader'
import { FloatingBookmark } from '@/components/fanfic/FloatingBookmark'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface ChapterInfo {
  id: string
  title: string
  date: string
  words_count: number
}

interface FanficFull {
  id: string
  title: string
  description: string
  dedication: string
  author_notes: string
  cover_url?: string
  direction: string
  rating: string
  completion_status: string
  likes: number
  trophies: number
  comments_count: number
  is_hot: boolean
  authors: Array<{ name: string; id: string; href: string; role: string }>
  fandoms: string[]
  pairings: Array<{ characters: string[]; is_highlight: boolean }>
  tags: Array<{ name: string; is_adult: boolean }>
  chapters: ChapterInfo[]
  is_single_chapter: boolean
  single_chapter_html?: string
}

const DIRECTION_COLORS: Record<string, string> = {
  'Слэш': 'bg-blue-900/60 text-blue-300 border-blue-700/40',
  'Гет': 'bg-pink-900/60 text-pink-300 border-pink-700/40',
  'Джен': 'bg-green-900/60 text-green-300 border-green-700/40',
  'Фемслэш': 'bg-purple-900/60 text-purple-300 border-purple-700/40',
  'Смешанное': 'bg-yellow-900/60 text-yellow-300 border-yellow-700/40',
}

const RATING_COLORS: Record<string, string> = {
  'G': 'bg-emerald-900/60 text-emerald-300 border-emerald-700/40',
  'PG-13': 'bg-yellow-900/60 text-yellow-300 border-yellow-700/40',
  'R': 'bg-orange-900/60 text-orange-300 border-orange-700/40',
  'NC-17': 'bg-red-900/60 text-red-300 border-red-700/40',
  'NC-21': 'bg-red-950/80 text-red-400 border-red-800/60',
}

const AVATAR_GRADIENTS = [
  'from-purple-600 to-pink-600',
  'from-blue-600 to-cyan-600',
  'from-emerald-600 to-teal-600',
  'from-orange-600 to-rose-600',
  'from-indigo-600 to-purple-600',
  'from-amber-600 to-red-600',
]

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center px-2.5 py-1 rounded text-xs font-medium border', className)}>
      {children}
    </span>
  )
}

interface ActionState {
  is_liked: boolean
  is_read: boolean
  is_followed: boolean
}
const actionCache = new Map<string, ActionState>()

function ScrollToTopButton({ offsetBottom = 'bottom-6' }: { offsetBottom?: string }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible) return null

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      title="Наверх"
      className={cn(
        'fixed right-6 z-30 w-12 h-12 rounded-full flex items-center justify-center shadow-lg border transition-all',
        'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700 shadow-black/40',
        offsetBottom,
      )}
    >
      <ChevronUp size={22} />
    </button>
  )
}

export default function FanficPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { accessToken } = useAuthStore()
  const recordHistory = useReaderStore(s => s.recordHistory)
  const setBookmark = useReaderStore(s => s.setBookmark)
  const removeBookmark = useReaderStore(s => s.removeBookmark)
  // Anchor selector must be at top-level of the component (Rules of Hooks) —
  // NOT after any early return below. React error #310 fires the moment a
  // hook count differs between renders. See fanfic detail page load = 2
  // renders: (1) loading=true → early return, (2) fanfic loaded → falls
  // through to the full body. Every hook has to be called in both.
  const anchor = useReaderStore(s => (s.anchors ?? {})[id ?? ''])
  const [fanfic, setFanfic] = useState<FanficFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [actState, setActState] = useState<ActionState>(() =>
    actionCache.get(id ?? '') ?? { is_liked: false, is_read: false, is_followed: false }
  )
  const [actLoading, setActLoading] = useState<string | null>(null)

  const [downloadOpen, setDownloadOpen] = useState(false)
  const [downloadingFmt, setDownloadingFmt] = useState<string | null>(null)
  const downloadRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!downloadOpen) return
    const onClick = (e: MouseEvent) => {
      if (downloadRef.current && !downloadRef.current.contains(e.target as Node)) {
        setDownloadOpen(false)
      }
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [downloadOpen])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetch(`${API_URL}/api/v1/fanfics/${id}/full`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        setFanfic(data)
        setLoading(false)
        // Record this fanfic in the local history so it shows up under
        // /profile → История even for anonymous browsing.
        if (data?.id && data?.title) {
          recordHistory({
            fanficId: data.id,
            title: data.title,
            author_name: data.authors?.[0]?.name ?? '',
            author_id: data.authors?.[0]?.id,
            cover_url: data.cover_url ?? null,
            direction: data.direction,
            rating: data.rating,
            completion_status: data.completion_status,
            fandoms: data.fandoms ?? [],
          })
        }
      })
      .catch(e => { setError(e.message); setLoading(false) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (!accessToken || !id) return
    if (actionCache.has(id)) {
      setActState(actionCache.get(id)!)
      return
    }
    // Seed is_liked from the local bookmark state immediately — this is our
    // source of truth for "в избранном?" and works even for users without a
    // linked ficbook account.
    const localLiked = !!(useReaderStore.getState().bookmarks ?? {})[id]
    if (localLiked) {
      const s = { is_liked: true, is_read: false, is_followed: false }
      actionCache.set(id, s)
      setActState(s)
    }
    // Best-effort fetch of ficbook-side state (only useful if the user has
    // linked a ficbook account — 403 otherwise, which we silently ignore).
    fetch(`${API_URL}/api/v1/actions/state/${id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        // Merge local ⋁ ficbook — bookmark is "liked" if EITHER says so.
        const s = {
          is_liked: !!d.is_liked || localLiked,
          is_read: !!d.is_read,
          is_followed: !!d.is_followed,
        }
        actionCache.set(id, s)
        setActState(s)
      })
      .catch(() => {})
  }, [id, accessToken])

  const doAction = async (action: string) => {
    if (!accessToken || !id) return
    setActLoading(action)
    // Optimistic update — flip the flag immediately so the button gives
    // instant feedback even before the ficbook AJAX round-trip settles.
    const prev = actState
    const optimistic: ActionState = { ...prev }
    if (action === 'like') optimistic.is_liked = true
    else if (action === 'unlike') optimistic.is_liked = false
    else if (action === 'mark-read') optimistic.is_read = true
    else if (action === 'mark-unread') optimistic.is_read = false
    else if (action === 'follow') optimistic.is_followed = true
    else if (action === 'unfollow') optimistic.is_followed = false
    setActState(optimistic)
    actionCache.set(id, optimistic)

    // Like/unlike ALSO toggles the local bookmark — this is the "в избранное"
    // action from the user's POV, and local bookmarks survive without a
    // linked ficbook account and sync across devices via /profile/bookmarks.
    if (action === 'like' && fanfic) {
      setBookmark({
        fanficId: id,
        title: fanfic.title,
        author_name: fanfic.authors?.[0]?.name ?? '',
        author_id: fanfic.authors?.[0]?.id,
        cover_url: fanfic.cover_url ?? null,
        direction: fanfic.direction,
        rating: fanfic.rating,
        completion_status: fanfic.completion_status,
        fandoms: fanfic.fandoms,
      })
    } else if (action === 'unlike') {
      removeBookmark(id)
    }

    try {
      const resp = await fetch(`${API_URL}/api/v1/actions/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ fanfic_id: id }),
      })
      if (!resp.ok) {
        // Roll back the action-bar state on HTTP error, but KEEP the local
        // bookmark change — the local bookmark works regardless of whether
        // the ficbook mirror succeeded. 403 here = no ficbook cookies, and
        // that's OK: the user's local favourites are still stored.
        setActState(prev)
        actionCache.set(id, prev)
        const err = await resp.json().catch(() => ({ detail: '' }))
        const detail = (err.detail || '').toString()
        if (resp.status === 403) {
          alert(
            detail.toLowerCase().includes('log in')
              ? 'Нужно войти в ficbook через нашу форму логина, чтобы синхронизировать это действие.'
              : (detail || 'Действие недоступно.'),
          )
        } else if (resp.status === 429) {
          alert(detail || 'Ficbook ограничил частоту запросов. Попробуй через минуту.')
        }
        // 5xx / other: keep optimistic state (best-effort). Ficbook AJAX is
        // notoriously flaky; forcing rollback on every network hiccup annoys
        // users more than an occasional lag.
      }
      // We intentionally do NOT read `data.success` — ficbook's /ajax/mark
      // returns result:false when the fic is already in the target state
      // (e.g. liking something that's already liked). Trusting the HTTP
      // status is enough; the optimistic flip stays.
    } catch {
      // Network failure — roll back.
      setActState(prev)
      actionCache.set(id, prev)
    }
    setActLoading(null)
  }

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Loader label="Загружаем с ficbook.net..." />
      </main>
    )
  }

  if (error || !fanfic) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-red-400">Ошибка загрузки: {error}</p>
        <button type="button" onClick={() => router.push('/')} className="mt-4 text-zinc-400 hover:text-zinc-200 flex items-center gap-2">
          <ArrowLeft size={16} /> Назад
        </button>
      </main>
    )
  }

  const ficbookUrl = `https://ficbook.net/readfic/${id}`
  const ficbookCommentsUrl = `${ficbookUrl}/comments#comments-list`
  const chapterIds = fanfic.chapters.map(c => c.id).join(',')
  const readHref = fanfic.is_single_chapter
    ? `/fanfic/${id}/read`
    : fanfic.chapters.length > 0
      ? `/fanfic/${id}/read/${fanfic.chapters[0].id}?all=${chapterIds}`
      : null

  // Anchor for this fanfic. If set, we surface a "Продолжить с якоря" CTA
  // next to "Читать" that jumps straight to the anchor's chapter with a
  // ?anchor=1 query so ReaderContent knows to restore to anchor.scrollY.
  // NOTE: the underlying useReaderStore selector is called at the top of the
  // component — we only compute derived values here so subsequent early
  // returns don't shift hook order.
  const anchorHref = (() => {
    if (!anchor) return null
    if (anchor.chapterId === 'single' || fanfic.is_single_chapter) {
      return `/fanfic/${id}/read?anchor=1`
    }
    // Verify the anchor's chapter still exists in this fic (chapter might have
    // been deleted by the author since the user placed the anchor).
    const exists = fanfic.chapters.some(c => c.id === anchor.chapterId)
    if (!exists) return null
    return `/fanfic/${id}/read/${anchor.chapterId}?all=${chapterIds}&anchor=1`
  })()
  const anchorChapterMeta = anchor
    ? fanfic.chapters.find(c => c.id === anchor.chapterId)
    : null

  const likeCount = fanfic.likes + (actState.is_liked ? 1 : 0)

  return (
    <>
      <main className="max-w-4xl mx-auto px-4 py-8 pb-24">
        {/* Back */}
        <button type="button" onClick={() => router.push('/')} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 mb-6 transition-colors text-sm">
          <ArrowLeft size={14} /> Назад
        </button>

        {/* HERO: badges → title → stats */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-1.5 mb-4 justify-center sm:justify-start">
            {fanfic.is_hot && (
              <Chip className="bg-orange-900/60 text-orange-300 border-orange-700/40">
                <Flame size={12} className="mr-1" /> Горячая работа
              </Chip>
            )}
            {fanfic.direction && fanfic.direction !== 'Неизвестно' && (
              <Chip className={DIRECTION_COLORS[fanfic.direction] ?? 'bg-zinc-700/60 text-zinc-300 border-zinc-600/40'}>{fanfic.direction}</Chip>
            )}
            {fanfic.rating && fanfic.rating !== 'Неизвестно' && (
              <Chip className={RATING_COLORS[fanfic.rating] ?? 'bg-zinc-700/60 text-zinc-300 border-zinc-600/40'}>{fanfic.rating}</Chip>
            )}
            {fanfic.completion_status && fanfic.completion_status !== 'Неизвестно' && (
              <Chip className={fanfic.completion_status === 'Завершён' ? 'bg-teal-900/60 text-teal-300 border-teal-700/40' : 'bg-zinc-700/60 text-zinc-400 border-zinc-600/40'}>
                {fanfic.completion_status === 'Завершён' ? '✓' : fanfic.completion_status === 'В процессе' ? '⟳' : '❄'} {fanfic.completion_status}
              </Chip>
            )}
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold text-zinc-100 leading-tight mb-4 text-center sm:text-left">
            {fanfic.title}
          </h1>

          {/* Stats: likes/trophies/comments/chapters */}
          <div className="flex items-center flex-wrap gap-4 text-sm text-zinc-500 justify-center sm:justify-start">
            {likeCount > 0 && <span className="flex items-center gap-1"><Heart size={14} />{formatNumber(likeCount)}</span>}
            {fanfic.trophies > 0 && <span className="flex items-center gap-1"><Trophy size={14} />{formatNumber(fanfic.trophies)}</span>}
            {fanfic.comments_count > 0 && <span className="flex items-center gap-1"><MessageSquare size={14} />{formatNumber(fanfic.comments_count)}</span>}
            {fanfic.chapters.length > 0 && <span className="flex items-center gap-1"><BookOpen size={14} />{fanfic.chapters.length} глав</span>}
          </div>
        </div>

        {/* COVER — full container width on mobile (like ficbook), capped on desktop, natural aspect */}
        {fanfic.cover_url && (
          <div className="mb-6">
            <div className="w-full sm:max-w-md sm:mx-auto rounded-xl overflow-hidden shadow-lg shadow-black/40 ring-1 ring-zinc-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fanfic.cover_url}
                alt={fanfic.title}
                className="w-full h-auto block"
                loading="eager"
              />
            </div>
          </div>
        )}

        {/* AUTHOR block */}
        {fanfic.authors.length > 0 && (
          <div className="mb-6 flex flex-col gap-3 items-center sm:items-start">
            {fanfic.authors.map((author, i) => {
              const gradient = AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length]
              const initial = author.name?.trim().charAt(0).toUpperCase() || '?'
              const authorUrl = `https://ficbook.net${author.href}`
              return (
                <div key={i} className="flex items-center gap-3">
                  <a
                    href={authorUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base bg-gradient-to-br shadow-sm',
                      'hover:ring-2 hover:ring-purple-500/60 transition-all',
                      gradient
                    )}
                    title={author.name}
                  >
                    {initial}
                  </a>
                  <div className="flex flex-col leading-tight">
                    <a
                      href={authorUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-zinc-200 hover:text-purple-400 transition-colors"
                    >
                      {author.name}
                    </a>
                    <span className="text-xs text-zinc-500">{author.role || 'автор'}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* PRIMARY CTA — Читать + опционально Продолжить с якоря */}
        {readHref && (
          <div className="mb-4 flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <Link
              href={readHref}
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-base font-semibold transition-colors shadow-md shadow-purple-950/30"
            >
              <BookMarked size={16} /> Читать
            </Link>
            {anchorHref && (
              <Link
                href={anchorHref}
                title={
                  anchorChapterMeta
                    ? `Продолжить: ${anchorChapterMeta.title}`
                    : 'Продолжить с последнего якоря'
                }
                className={cn(
                  'group inline-flex items-center gap-2 rounded-lg text-base font-semibold transition-all',
                  'px-5 py-3',
                  // Solid fill so it reads as a peer CTA to "Читать", but a
                  // distinct hue (indigo→fuchsia gradient) so users see it's
                  // a different action. Bright ring keeps it findable on the
                  // dark background where the previous ghost style vanished.
                  'text-white bg-gradient-to-r from-indigo-500 to-fuchsia-500',
                  'hover:from-indigo-400 hover:to-fuchsia-400',
                  'shadow-lg shadow-fuchsia-900/40 ring-1 ring-fuchsia-300/40',
                )}
              >
                <Anchor size={16} className="fill-white/30" />
                <span>Продолжить с якоря</span>
                {anchorChapterMeta && (
                  <span className="hidden md:inline text-white/70 font-normal text-sm">
                    · {anchorChapterMeta.title.length > 24
                        ? anchorChapterMeta.title.slice(0, 24) + '…'
                        : anchorChapterMeta.title}
                  </span>
                )}
              </Link>
            )}
          </div>
        )}

        {/* ACTION BAR — 4 buttons */}
        <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* В избранное (=like on ficbook — appears in profile → Избранное tab) */}
          <button
            type="button"
            onClick={() => doAction(actState.is_liked ? 'unlike' : 'like')}
            disabled={!accessToken || actLoading === 'like' || actLoading === 'unlike'}
            title={!accessToken ? 'Войдите, чтобы добавить в избранное' : (actState.is_liked ? 'Убрать из избранного' : 'Добавить в избранное')}
            className={cn(
              'flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-lg border text-xs font-medium transition-all',
              actState.is_liked
                ? 'bg-pink-900/60 text-pink-100 border-pink-500/70 ring-1 ring-pink-500/30'
                : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-pink-700/60 hover:text-pink-300',
              (!accessToken) && 'opacity-60 cursor-not-allowed'
            )}
          >
            <span className="flex items-center gap-1.5">
              {(actLoading === 'like' || actLoading === 'unlike')
                ? <Loader2 size={16} className="animate-spin" />
                : <Heart size={16} className={actState.is_liked ? 'fill-pink-300 text-pink-200' : ''} />
              }
              <span className="tabular-nums">{formatNumber(likeCount)}</span>
            </span>
            <span>{actState.is_liked ? 'В избранном ✓' : 'В избранное'}</span>
          </button>

          {/* Подписаться */}
          <button
            type="button"
            onClick={() => doAction(actState.is_followed ? 'unfollow' : 'follow')}
            disabled={!accessToken || actLoading === 'follow' || actLoading === 'unfollow'}
            title={!accessToken ? 'Войдите, чтобы подписаться' : (actState.is_followed ? 'Отписаться' : 'Подписаться')}
            className={cn(
              'flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-lg border text-xs font-medium transition-all',
              actState.is_followed
                ? 'bg-purple-900/60 text-purple-200 border-purple-600/60'
                : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-purple-700/60 hover:text-purple-300',
              (!accessToken) && 'opacity-60 cursor-not-allowed'
            )}
          >
            <span className="flex items-center gap-1.5">
              {(actLoading === 'follow' || actLoading === 'unfollow')
                ? <Loader2 size={16} className="animate-spin" />
                : actState.is_followed ? <BellOff size={16} /> : <Bell size={16} />
              }
            </span>
            <span>{actState.is_followed ? 'Подписан' : 'Подписаться'}</span>
          </button>

          {/* Отзывы */}
          <a
            href={ficbookCommentsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-blue-700/60 hover:text-blue-300 text-xs font-medium transition-all"
          >
            <span className="flex items-center gap-1.5">
              <MessageSquare size={16} />
              <span className="tabular-nums">{formatNumber(fanfic.comments_count)}</span>
            </span>
            <span>Отзывы</span>
          </a>

          {/* В сборник */}
          <a
            href={ficbookUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Добавить в сборник на ficbook.net"
            className="flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-amber-700/60 hover:text-amber-300 text-xs font-medium transition-all"
          >
            <span className="flex items-center gap-1.5">
              <FolderPlus size={16} />
            </span>
            <span>В сборник</span>
          </a>
        </div>

        {/* Fandoms & Pairings */}
        <div className="mb-6 space-y-2">
          {fanfic.fandoms.length > 0 && (
            <div className="text-sm">
              <span className="text-zinc-600">Фэндом: </span>
              {fanfic.fandoms.map((f, i) => (
                <span key={i}>
                  {i > 0 && <span className="text-zinc-600">, </span>}
                  <Link href={`/search?q=${encodeURIComponent(f)}`} className="text-zinc-400 hover:text-purple-400 transition-colors">{f}</Link>
                </span>
              ))}
            </div>
          )}

          {fanfic.pairings.length > 0 && (
            <div className="text-sm">
              <span className="text-zinc-600">Пэйринг и персонажи: </span>
              {fanfic.pairings.map((p, i) => (
                <span key={i}>
                  {i > 0 && <span className="text-zinc-600">, </span>}
                  <span className={p.is_highlight ? 'text-purple-400' : 'text-zinc-400'}>{p.characters.join('/')}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Chapter list */}
        {fanfic.chapters.length > 1 && (
          <div className="mb-6">
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
              Содержание ({fanfic.chapters.length})
            </h3>
            <div className="border border-zinc-800 rounded-lg overflow-hidden">
              {fanfic.chapters.map((ch, idx) => (
                <Link
                  key={ch.id}
                  href={`/fanfic/${id}/read/${ch.id}?all=${chapterIds}`}
                  className={`flex items-center justify-between px-4 py-3 hover:bg-zinc-800/60 transition-colors group ${
                    idx < fanfic.chapters.length - 1 ? 'border-b border-zinc-800' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-zinc-200 group-hover:text-white text-sm font-medium truncate transition-colors">
                      {ch.title || `Часть ${idx + 1}`}
                    </p>
                    {(ch.date || ch.words_count > 0) && (
                      <p className="text-zinc-600 text-xs mt-0.5">
                        {ch.date && <span>{ch.date}</span>}
                        {ch.date && ch.words_count > 0 && <span className="mx-1.5">·</span>}
                        {ch.words_count > 0 && <span>{formatWordCount(ch.words_count)} слов</span>}
                      </p>
                    )}
                  </div>
                  <svg className="text-zinc-600 group-hover:text-zinc-400 flex-shrink-0 ml-3 transition-colors" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {fanfic.description && (
          <div className="mb-6 p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Описание</h3>
            <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-line">{fanfic.description}</p>
          </div>
        )}

        {/* Dedication */}
        {fanfic.dedication && (
          <div className="mb-4 pl-4 border-l-2 border-zinc-700">
            <p className="text-zinc-500 text-sm italic">{fanfic.dedication}</p>
          </div>
        )}

        {/* Author notes */}
        {fanfic.author_notes && (
          <div className="mb-6 p-4 bg-zinc-800/50 border border-zinc-700/50 rounded-lg">
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">От автора</h3>
            <p className="text-zinc-400 text-sm leading-relaxed whitespace-pre-line">{fanfic.author_notes}</p>
          </div>
        )}

        {/* Download dropdown */}
        {accessToken ? (
          <div className="mb-6 flex justify-center sm:justify-start relative" ref={downloadRef}>
            <button
              type="button"
              onClick={() => setDownloadOpen(v => !v)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-700 hover:bg-zinc-800 text-zinc-300 rounded-lg text-sm transition-colors"
            >
              <Download size={16} /> Скачать
              <ChevronDown size={14} className={cn('transition-transform', downloadOpen && 'rotate-180')} />
            </button>
            {downloadOpen && (
              <div className="absolute z-20 top-full mt-2 left-0 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl overflow-hidden min-w-[220px]">
                {(['txt', 'epub', 'pdf', 'fb2'] as const).map(ext => (
                  <button
                    key={ext}
                    type="button"
                    disabled={downloadingFmt !== null}
                    onClick={async () => {
                      setDownloadingFmt(ext)
                      try {
                        const res = await fetch(`${API_URL}/api/v1/actions/download/${id}/${ext}`, {
                          headers: { Authorization: `Bearer ${accessToken}` },
                        })
                        if (!res.ok) {
                          const err = await res.json().catch(() => ({ detail: '' }))
                          const detail = (err.detail || '').toString()
                          // Map common backend errors to human messages
                          let message = detail
                          if (res.status === 401) {
                            message = 'Сессия истекла. Перелогинься через кнопку "Войти".'
                          } else if (res.status === 403) {
                            // Backend says: "Not logged in to ficbook. Please log in again."
                            // — that's the case when the JWT is fine but there are no
                            // ficbook session cookies stored, i.e. the user hasn't used
                            // the ficbook login flow.
                            message = detail.toLowerCase().includes('log in')
                              ? 'Нужно войти в ficbook через нашу форму логина, чтобы скачивание работало от твоего имени.'
                              : (detail || 'Скачивание недоступно (нужна авторизация или премиум на ficbook).')
                          } else if (res.status === 429) {
                            message = detail || 'Ficbook ограничил частоту скачиваний. Попробуй через 5–10 минут.'
                          } else if (res.status === 404 || res.status === 502) {
                            message = detail || 'Не удалось получить файл с ficbook. Возможно, формат недоступен для этой работы.'
                          } else if (!message) {
                            message = `Ошибка ${res.status}`
                          }
                          alert(message)
                          return
                        }
                        const blob = await res.blob()
                        const disposition = res.headers.get('content-disposition') || ''
                        const fnameMatch = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)
                        const filename = fnameMatch ? decodeURIComponent(fnameMatch[1]) : `${fanfic.title.replace(/[^\w\sа-яА-Я-]/g, '')}.${ext}`
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = filename
                        document.body.appendChild(a)
                        a.click()
                        a.remove()
                        URL.revokeObjectURL(url)
                        setDownloadOpen(false)
                      } catch (e) {
                        alert(String(e))
                      } finally {
                        setDownloadingFmt(null)
                      }
                    }}
                    className="w-full flex items-center justify-between px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors border-b border-zinc-800 last:border-b-0 disabled:opacity-50"
                  >
                    <span className="font-medium uppercase">{ext}</span>
                    {downloadingFmt === ext ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} className="opacity-60" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="mb-6 flex justify-center sm:justify-start">
            <a
              href={`https://ficbook.net/readfic/${id}/download`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-700 hover:bg-zinc-800 text-zinc-300 rounded-lg text-sm transition-colors opacity-60"
              title="Войдите чтобы скачать напрямую"
            >
              <Download size={16} /> Скачать на ficbook.net
            </a>
          </div>
        )}

        {/* Tags */}
        {fanfic.tags.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Метки</h3>
            <div className="flex flex-wrap gap-1.5">
              {fanfic.tags.map((tag, i) => (
                <Link
                  key={i}
                  href={`/search?q=${encodeURIComponent(tag.name)}`}
                  className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded text-xs border transition-all',
                    tag.is_adult
                      ? 'bg-red-950/40 text-red-400 border-red-800/40 hover:bg-red-900/50'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700/40 hover:border-zinc-500/60 hover:text-zinc-200'
                  )}
                >
                  {tag.name}
                  {tag.is_adult && <span className="ml-1 text-red-500 font-bold text-[10px]">18+</span>}
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Scroll-to-top button (shows after scrolling 400px down) */}
      <ScrollToTopButton offsetBottom={accessToken ? 'bottom-24' : 'bottom-6'} />

      {/* Fixed bottom-right favourites toggle. Writes the local bookmark
          (useReaderStore.bookmarks) which syncs to /api/v1/profile/bookmarks
          — so hitting the button here surfaces the fic in /profile → Избранное
          on every device the user is signed into. */}
      {accessToken && (
        <FloatingBookmark
          fanficId={id}
          meta={{
            title: fanfic.title,
            author_name: fanfic.authors?.[0]?.name,
            author_id: fanfic.authors?.[0]?.id,
            cover_url: fanfic.cover_url ?? null,
            direction: fanfic.direction,
            rating: fanfic.rating,
            completion_status: fanfic.completion_status,
            fandoms: fanfic.fandoms,
          }}
        />
      )}
    </>
  )
}
