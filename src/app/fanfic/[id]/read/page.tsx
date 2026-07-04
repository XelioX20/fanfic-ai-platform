'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Search } from 'lucide-react'
import { ReaderContent } from '@/components/reader/ReaderContent'
import { ReaderSettingsPanel } from '@/components/reader/ReaderSettings'
import { AnchorButton } from '@/components/reader/AnchorButton'
import { ReaderSearchBar } from '@/components/reader/ReaderSearchBar'
import { Loader } from '@/components/ui/Loader'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function SingleChapterReaderPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const useAnchor = searchParams.get('anchor') === '1'
  const [html, setHtml] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    fetch(`${API_URL}/api/v1/fanfics/${id}/full`)
      .then(r => r.json())
      .then(data => {
        setTitle(data.title)
        setHtml(data.single_chapter_html || '<p>Содержимое недоступно</p>')
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [id])

  if (loading) return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <Loader label="Загружаем с ficbook.net..." />
    </main>
  )

  if (error) return (
    <div className="min-h-screen bg-zinc-950 p-8">
      <p className="text-red-400">Ошибка: {error}</p>
    </div>
  )

  return (
    <div className="min-h-screen">
      {/* Top bar: [←] [title (centre)] [🔍 · настройки] */}
      <div className="sticky top-0 z-40 bg-zinc-900/95 backdrop-blur border-b border-zinc-800 px-4 py-3 flex items-center gap-2">
        <button type="button" onClick={() => router.push(`/fanfic/${id}`)}
          className="shrink-0 p-1 text-zinc-400 hover:text-zinc-200 transition-colors" title="Назад" aria-label="Назад">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0 text-center">
          <p className="text-zinc-300 text-sm font-medium truncate">{title}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={() => setSearchOpen(v => !v)}
            title="Поиск по тексту (Ctrl+F)" aria-label="Поиск по тексту"
            className="p-2 text-zinc-400 hover:text-zinc-200 transition-colors">
            <Search size={16} />
          </button>
          <ReaderSettingsPanel />
        </div>
      </div>
      {/* Search bar — appears below topbar when open */}
      <ReaderSearchBar open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ReaderContent
        content={html || ''}
        progressKey={`${id}:single`}
        restoreFromAnchor={useAnchor}
        anchorFanficId={id}
        anchorChapterId="single"
      />
      {/* Anchor FAB */}
      <AnchorButton fanficId={id} chapterId="single" chapterTitle={title} />
    </div>
  )
}
