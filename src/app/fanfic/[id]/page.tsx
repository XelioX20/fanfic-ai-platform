'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Heart, Trophy, MessageSquare, BookOpen, User, ArrowLeft, BookMarked, ExternalLink } from 'lucide-react'
import { api } from '@/lib/api'
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

function Chip({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <span
      onClick={onClick}
      className={cn('inline-flex items-center px-2.5 py-1 rounded text-xs font-medium border', onClick && 'cursor-pointer hover:opacity-80', className)}
    >
      {children}
    </span>
  )
}

export default function FanficPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [fanfic, setFanfic] = useState<FanficFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
  const chapterIds = fanfic.chapters.map(c => c.id).join(',')

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      {/* Back */}
      <button type="button" onClick={() => router.push('/')} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 mb-6 transition-colors text-sm">
        <ArrowLeft size={14} /> Назад
      </button>

      {/* Header */}
      <div className="flex gap-6 mb-6">
        {fanfic.cover_url && (
          <div className="flex-shrink-0 w-36 h-52 relative rounded-lg overflow-hidden">
            <Image src={fanfic.cover_url} alt={fanfic.title} fill className="object-cover" unoptimized />
          </div>
        )}
        <div className="flex-1 min-w-0">
          {/* Badges */}
          <div className="flex flex-wrap gap-1.5 mb-3">
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
            {fanfic.is_hot && <Chip className="bg-orange-900/60 text-orange-300 border-orange-700/40">🔥 Горячая работа</Chip>}
          </div>

          <h1 className="text-2xl font-bold text-zinc-100 mb-3 leading-tight">{fanfic.title}</h1>

          {/* Authors */}
          <div className="space-y-0.5 mb-3">
            {fanfic.authors.map((author, i) => (
              <div key={i} className="flex items-center gap-1.5 text-sm text-zinc-400">
                <User size={13} className="text-zinc-500" />
                <a href={`https://ficbook.net${author.href}`} target="_blank" rel="noopener noreferrer" className="hover:text-purple-400 transition-colors">
                  {author.name}
                </a>
                {author.role && <span className="text-zinc-600 text-xs">({author.role})</span>}
              </div>
            ))}
          </div>

          {/* Fandoms */}
          {fanfic.fandoms.length > 0 && (
            <div className="text-sm mb-2">
              <span className="text-zinc-600">Фэндом: </span>
              {fanfic.fandoms.map((f, i) => (
                <span key={i}>
                  {i > 0 && <span className="text-zinc-600">, </span>}
                  <Link href={`/search?q=${encodeURIComponent(f)}`} className="text-zinc-400 hover:text-purple-400 transition-colors">{f}</Link>
                </span>
              ))}
            </div>
          )}

          {/* Pairings */}
          {fanfic.pairings.length > 0 && (
            <div className="text-sm mb-3">
              <span className="text-zinc-600">Пэйринг и персонажи: </span>
              {fanfic.pairings.map((p, i) => (
                <span key={i}>
                  {i > 0 && <span className="text-zinc-600">, </span>}
                  <span className={p.is_highlight ? 'text-purple-400' : 'text-zinc-400'}>{p.characters.join('/')}</span>
                </span>
              ))}
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center flex-wrap gap-4 text-sm text-zinc-500 mb-3">
            {fanfic.likes > 0 && <span className="flex items-center gap-1"><Heart size={14} />{formatNumber(fanfic.likes)}</span>}
            {fanfic.trophies > 0 && <span className="flex items-center gap-1"><Trophy size={14} />{formatNumber(fanfic.trophies)}</span>}
            {fanfic.comments_count > 0 && <span className="flex items-center gap-1"><MessageSquare size={14} />{formatNumber(fanfic.comments_count)}</span>}
            {fanfic.chapters.length > 0 && <span className="flex items-center gap-1"><BookOpen size={14} />{fanfic.chapters.length} глав</span>}
          </div>

          {/* Actions */}
          <div className="flex gap-3 flex-wrap">
            {(fanfic.is_single_chapter || fanfic.chapters.length > 0) && (
              <Link
                href={fanfic.is_single_chapter ? `/fanfic/${id}/read` : `/fanfic/${id}/read/${fanfic.chapters[0].id}?all=${chapterIds}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-sm font-medium transition-colors"
              >
                <BookMarked size={14} /> Читать
              </Link>
            )}
            <a
              href={ficbookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-700 hover:bg-zinc-800 text-zinc-300 rounded-md text-sm transition-colors"
            >
              <ExternalLink size={14} /> На ficbook.net
            </a>
          </div>

        </div>
      </div>

      {/* Chapter list — full width below header */}
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

    </main>
  )
}
