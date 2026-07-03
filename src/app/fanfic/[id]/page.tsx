'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import {
  Heart, Trophy, MessageSquare, BookOpen, ArrowLeft, BookMarked,
  Bell, BellOff, FolderPlus, Download, Loader2, ChevronDown, Flame,
} from 'lucide-react'
import { useAuthStore } from '@/store'
import { cn, formatNumber, formatWordCount } from '@/lib/utils'

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

export default function FanficPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { accessToken } = useAuthStore()
  const [fanfic, setFanfic] = useState<FanficFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [actState, setActState] = useState<ActionState>(() =>
    actionCache.get(id ?? '') ?? { is_liked: false, is_read: false, is_followed: false }
  )
  const [actLoading, setActLoading] = useState<string | null>(null)
  const [downloadOpen, setDownloadOpen] = useState(false)
  const downloadRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetch(`${API_URL}/api/v1/fanfics/${id}/full`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => { setFanfic(data); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [id])

  useEffect(() => {
    if (!accessToken || !id) return
    if (actionCache.has(id)) {
      setActState(actionCache.get(id)!)
      return
    }
    fetch(`${API_URL}/api/v1/actions/state/${id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(r => r.json())
      .then(d => {
        const s = { is_liked: !!d.is_liked, is_read: !!d.is_read, is_followed: !!d.is_followed }
        actionCache.set(id, s)
        setActState(s)
      })
      .catch(() => {})
  }, [id, accessToken])

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

  const doAction = async (action: string) => {
    if (!accessToken || !id) return
    setActLoading(action)
    try {
      const resp = await fetch(`${API_URL}/api/v1/actions/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ fanfic_id: id }),
      })
      const data = await resp.json()
      if (data.success) {
        const newState = { ...actState }
        if (action === 'like') newState.is_liked = true
        if (action === 'unlike') newState.is_liked = false
        if (action === 'mark-read') newState.is_read = true
        if (action === 'mark-unread') newState.is_read = false
        if (action === 'follow') newState.is_followed = true
        if (action === 'unfollow') newState.is_followed = false
        actionCache.set(id, newState)
        setActState(newState)
      }
    } catch {}
    setActLoading(null)
  }

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-zinc-800 rounded w-3/4" />
          <div className="h-4 bg-zinc-800 rounded w-1/2" />
          <div className="h-32 bg-zinc-800 rounded" />
        </div>
        <p className="text-zinc-500 text-sm mt-4 text-center">Загружаем с ficbook.net...</p>
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
  const ficbookCommentsUrl = `${ficbookUrl}#comments`
  const chapterIds = fanfic.chapters.map(c => c.id).join(',')
  const readHref = fanfic.is_single_chapter
    ? `/fanfic/${id}/read`
    : fanfic.chapters.length > 0
      ? `/fanfic/${id}/read/${fanfic.chapters[0].id}?all=${chapterIds}`
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

        {/* COVER — centered, ~3:4 ratio, rounded */}
        {fanfic.cover_url && (
          <div className="mb-6 flex justify-center">
            <div className="w-full max-w-xs sm:max-w-sm aspect-[3/4] relative rounded-xl overflow-hidden shadow-lg shadow-black/40 ring-1 ring-zinc-800">
              <Image src={fanfic.cover_url} alt={fanfic.title} fill className="object-cover" unoptimized />
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

        {/* PRIMARY CTA — Читать */}
        {readHref && (
          <div className="mb-4 flex justify-center sm:justify-start">
            <Link
              href={readHref}
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-base font-semibold transition-colors shadow-md shadow-purple-950/30"
            >
              <BookMarked size={16} /> Читать
            </Link>
          </div>
        )}

        {/* ACTION BAR — 4 buttons */}
        <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Нравится */}
          <button
            type="button"
            onClick={() => doAction(actState.is_liked ? 'unlike' : 'like')}
            disabled={!accessToken || actLoading === 'like' || actLoading === 'unlike'}
            title={!accessToken ? 'Войдите, чтобы поставить лайк' : (actState.is_liked ? 'Убрать лайк' : 'Поставить лайк')}
            className={cn(
              'flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-lg border text-xs font-medium transition-all',
              actState.is_liked
                ? 'bg-pink-900/60 text-pink-200 border-pink-600/60'
                : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-pink-700/60 hover:text-pink-300',
              (!accessToken) && 'opacity-60 cursor-not-allowed'
            )}
          >
            <span className="flex items-center gap-1.5">
              {(actLoading === 'like' || actLoading === 'unlike')
                ? <Loader2 size={16} className="animate-spin" />
                : <Heart size={16} className={actState.is_liked ? 'fill-pink-300 text-pink-300' : ''} />
              }
              <span className="tabular-nums">{formatNumber(likeCount)}</span>
            </span>
            <span>Нравится</span>
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
            <div className="absolute z-20 top-full mt-2 left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl overflow-hidden min-w-[160px]">
              {(['txt', 'epub', 'pdf', 'fb2'] as const).map(ext => (
                <a
                  key={ext}
                  href={`https://ficbook.net/fanfic_download/${ext}?fanfic_id=${id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setDownloadOpen(false)}
                  className="block px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors border-b border-zinc-800 last:border-b-0"
                >
                  {ext.toUpperCase()}
                </a>
              ))}
            </div>
          )}
        </div>

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

      {/* Fixed bottom-right bookmark (mark as read) */}
      {accessToken && (
        <button
          type="button"
          onClick={() => doAction(actState.is_read ? 'mark-unread' : 'mark-read')}
          disabled={actLoading === 'mark-read' || actLoading === 'mark-unread'}
          title={actState.is_read ? 'Отметить непрочитанным' : 'Отметить прочитанным'}
          className={cn(
            'fixed bottom-6 right-6 z-30 w-12 h-12 rounded-full flex items-center justify-center shadow-lg border transition-all',
            actState.is_read
              ? 'bg-teal-600 hover:bg-teal-700 text-white border-teal-500 shadow-teal-950/50'
              : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700 shadow-black/40'
          )}
        >
          {(actLoading === 'mark-read' || actLoading === 'mark-unread')
            ? <Loader2 size={20} className="animate-spin" />
            : <BookMarked size={20} className={actState.is_read ? 'fill-white/20' : ''} />
          }
        </button>
      )}
    </>
  )
}
