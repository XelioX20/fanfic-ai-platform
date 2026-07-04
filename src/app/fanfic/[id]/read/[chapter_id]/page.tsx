'use client'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { ArrowLeft, ChevronLeft, ChevronRight, List, Search } from 'lucide-react'
import { ReaderContent } from '@/components/reader/ReaderContent'
import { ReaderSettingsPanel } from '@/components/reader/ReaderSettings'
import { AnchorButton } from '@/components/reader/AnchorButton'
import { ReaderSearchBar } from '@/components/reader/ReaderSearchBar'
import { Loader } from '@/components/ui/Loader'
import { useReaderStore } from '@/store'
import { formatWordCount } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface Chapter {
  id: string
  fanfic_id: string
  title: string
  date: string
  words_count: number
  html: string
  prev_chapter_id: string | null
  next_chapter_id: string | null
}

export default function ChapterReaderPage() {
  const { id, chapter_id } = useParams<{ id: string; chapter_id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const allChapters = searchParams.get('all') || ''
  const useAnchor = searchParams.get('anchor') === '1'

  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showChapterList, setShowChapterList] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const chapterIds = allChapters ? allChapters.split(',') : []
  const currentIdx = chapterIds.indexOf(chapter_id)

  useEffect(() => {
    if (!id || !chapter_id) return
    setLoading(true)
    const params = allChapters ? `?all_chapters=${encodeURIComponent(allChapters)}` : ''
    fetch(`${API_URL}/api/v1/fanfics/${id}/chapter/${chapter_id}${params}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => { setChapter(data); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [id, chapter_id, allChapters])

  // Scroll to top on chapter change is now handled inside ReaderContent via progressKey.
  // If a saved position exists it will be restored; otherwise scrolls to top.

  const goToChapter = (chapId: string) => {
    router.push(`/fanfic/${id}/read/${chapId}?all=${allChapters}`)
  }

  if (loading) return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <Loader label="Загружаем главу с ficbook.net..." />
    </main>
  )

  if (error) return (
    <div className="min-h-screen bg-zinc-950 p-8">
      <p className="text-red-400">Ошибка: {error}</p>
    </div>
  )

  if (!chapter) return null

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-zinc-900/95 backdrop-blur border-b border-zinc-800 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => router.push(`/fanfic/${id}`)}
            title="Назад к описанию"
            aria-label="Назад к описанию"
            className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 transition-colors text-sm flex-shrink-0"
          >
            <ArrowLeft size={16} />
          </button>

          <div className="flex-1 min-w-0 text-center">
            <p className="text-zinc-300 text-sm font-medium truncate">{chapter.title}</p>
            {currentIdx >= 0 && (
              <p className="text-zinc-600 text-xs">{currentIdx + 1} / {chapterIds.length}</p>
            )}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {chapterIds.length > 0 && (
              <button
                type="button"
                onClick={() => { setShowChapterList(!showChapterList); setSearchOpen(false) }}
                title="Содержание"
                aria-label="Содержание"
                className="p-2 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <List size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={() => { setSearchOpen(v => !v); setShowChapterList(false) }}
              title="Поиск по тексту (Ctrl+F)"
              aria-label="Поиск по тексту"
              className="p-2 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <Search size={16} />
            </button>
            <ReaderSettingsPanel />
          </div>
        </div>
        </div>
      </div>

      {/* Chapter list dropdown */}
      {showChapterList && chapterIds.length > 0 && (
        <div className="sticky top-14 z-30 bg-zinc-900 border-b border-zinc-800 max-h-64 overflow-y-auto">
          <div className="max-w-4xl mx-auto py-2">
            {chapterIds.map((chapId, idx) => (
              <button
                key={chapId}
                type="button"
                onClick={() => { goToChapter(chapId); setShowChapterList(false) }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${chapId === chapter_id ? 'text-purple-400 bg-purple-900/20' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
              >
                {idx + 1}. Глава {idx + 1}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Full-text search — controlled by topbar Search button */}
      <ReaderSearchBar open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Chapter info */}
      <div className="max-w-4xl mx-auto px-4 pt-6 pb-2">
        <div className="flex items-center justify-between text-xs text-zinc-600 mb-2">
          {chapter.words_count > 0 && <span>{formatWordCount(chapter.words_count)} слов</span>}
          {chapter.date && <span>{chapter.date}</span>}
        </div>
      </div>

      {/* Content */}
      <ReaderContent
        content={chapter.html}
        chapterTitle={chapter.title}
        progressKey={`${id}:${chapter_id}`}
        restoreFromAnchor={useAnchor}
        anchorFanficId={id}
        anchorChapterId={chapter_id}
      />

      {/* Anchor FAB — floats bottom-right, sits above content and bottom nav */}
      <AnchorButton fanficId={id} chapterId={chapter_id} chapterTitle={chapter.title} />

      {/* Bottom navigation */}
      <div className="border-t border-zinc-800 py-6 px-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => chapter.prev_chapter_id && goToChapter(chapter.prev_chapter_id)}
            disabled={!chapter.prev_chapter_id}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 rounded-lg text-sm transition-colors"
          >
            <ChevronLeft size={16} /> Предыдущая
          </button>

          <button
            type="button"
            onClick={() => router.push(`/fanfic/${id}`)}
            className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
          >
            К содержанию
          </button>

          <button
            type="button"
            onClick={() => chapter.next_chapter_id && goToChapter(chapter.next_chapter_id)}
            disabled={!chapter.next_chapter_id}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 rounded-lg text-sm transition-colors"
          >
            Следующая <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
