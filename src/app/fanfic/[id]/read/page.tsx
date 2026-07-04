'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Search } from 'lucide-react'
import { useReaderStore } from '@/store'
import { ReaderContent } from '@/components/reader/ReaderContent'
import { ReaderSettingsPanel } from '@/components/reader/ReaderSettings'
import { AnchorButton } from '@/components/reader/AnchorButton'
import { ReaderSearchBar } from '@/components/reader/ReaderSearchBar'
import { Loader } from '@/components/ui/Loader'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

/** Map reader theme → topbar background + border CSS values that match the text canvas. */
function topbarStyle(theme: string): { bg: string; border: string; text: string } {
  switch (theme) {
    case 'light':  return { bg: 'rgba(255,255,255,0.95)', border: '#e4e4e7', text: '#18181b' }
    case 'sepia':  return { bg: 'rgba(244,236,216,0.95)', border: '#d8ceb5', text: '#5b4636' }
    case 'paper':  return { bg: 'rgba(250,247,242,0.95)', border: '#e5e2dc', text: '#2a2a2a' }
    case 'amoled': return { bg: 'rgba(0,0,0,0.97)',       border: '#1f1f1f', text: '#e4e4e7' }
    default:       return { bg: 'rgba(26,26,26,0.95)',    border: '#27272a', text: '#d4d4d8' } // dark
  }
}

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
  const readerTheme = useReaderStore(s => s.settings.theme)
  const tb = topbarStyle(readerTheme)

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
    // Paint the whole page background with the reader theme so the site
    // body doesn't bleed through between the sticky topbar and .reader-content.
    <div className="min-h-screen" style={{ backgroundColor: tb.bg }}>
      {/* Top bar: [←] [title (centre)] [🔍 · настройки] */}
      <div
        className="sticky top-0 z-40 backdrop-blur border-b px-4 py-3 flex items-center gap-2 transition-colors duration-200"
        style={{ backgroundColor: tb.bg, borderColor: tb.border, color: tb.text }}
      >
        <button type="button" onClick={() => router.push(`/fanfic/${id}`)}
          className="shrink-0 p-1 transition-colors hover:opacity-70" title="Назад" aria-label="Назад">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0 text-center">
          <p className="text-sm font-medium truncate opacity-90">{title}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={() => setSearchOpen(v => !v)}
            title="Поиск по тексту (Ctrl+F)" aria-label="Поиск по тексту"
            className="p-2 transition-colors hover:opacity-70">
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
