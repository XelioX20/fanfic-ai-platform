'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ReaderContent } from '@/components/reader/ReaderContent'
import { ReaderSettingsPanel } from '@/components/reader/ReaderSettings'
import { AnchorButton } from '@/components/reader/AnchorButton'
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
      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-zinc-900/95 backdrop-blur border-b border-zinc-800 px-4 py-3 flex items-center justify-between gap-2">
        <button type="button" onClick={() => router.push(`/fanfic/${id}`)} className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 transition-colors text-sm min-w-0">
          <ArrowLeft size={16} />
          <span className="hidden sm:inline truncate max-w-xs">{title}</span>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <ReaderSettingsPanel />
        </div>
      </div>
      <ReaderContent
        content={html || ''}
        progressKey={`${id}:single`}
        restoreFromAnchor={useAnchor}
        anchorFanficId={id}
        anchorChapterId="single"
      />
      {/* Anchor FAB — floats bottom-right, sits above content */}
      <AnchorButton fanficId={id} chapterId="single" chapterTitle={title} />
    </div>
  )
}
