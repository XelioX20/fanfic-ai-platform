import { Metadata } from 'next'
import { Heart, Trophy, BookOpen, MessageSquare, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatNumber, formatWordCount } from '@/lib/utils'
import type { Fanfic } from '@/types'

interface Props {
  params: { id: string }
}

async function getFanfic(id: string): Promise<Fanfic | null> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  try {
    const res = await fetch(`${API_URL}/api/v1/fanfics/${id}`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const fanfic = await getFanfic(params.id)
  return {
    title: fanfic ? `${fanfic.title} | Fanfic AI Platform` : 'Fanfic',
    description: fanfic?.description,
  }
}

export default async function FanficPage({ params }: Props) {
  const fanfic = await getFanfic(params.id)

  if (!fanfic) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-zinc-400">Фанфик не найден</p>
      </main>
    )
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <article>
        <h1 className="text-2xl font-bold text-zinc-100 mb-2">{fanfic.title}</h1>
        <p className="text-zinc-400 mb-4">{fanfic.fandoms.join(', ')} · {fanfic.author_name}</p>

        <div className="flex flex-wrap gap-2 mb-4">
          <Badge variant="direction">{fanfic.direction}</Badge>
          <Badge variant="rating">{fanfic.rating}</Badge>
          <Badge variant="status">{fanfic.completion_status}</Badge>
          {fanfic.is_hot && <Badge variant="hot">🔥 Горячее</Badge>}
        </div>

        <div className="flex items-center gap-6 text-sm text-zinc-500 mb-6">
          <span className="flex items-center gap-1"><BookOpen size={14} />{formatWordCount(fanfic.words_count)} слов</span>
          <span className="flex items-center gap-1"><Heart size={14} />{formatNumber(fanfic.likes)}</span>
          <span className="flex items-center gap-1"><Trophy size={14} />{formatNumber(fanfic.trophies)}</span>
          <span className="flex items-center gap-1"><MessageSquare size={14} />{formatNumber(fanfic.comments_count)}</span>
        </div>

        {fanfic.description && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-6">
            <p className="text-zinc-300 text-sm leading-relaxed">{fanfic.description}</p>
          </div>
        )}

        <div className="flex gap-3">
          <a href={fanfic.ficbook_url} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <ExternalLink size={14} className="mr-2" />
              Читать на ficbook.net
            </Button>
          </a>
        </div>
      </article>
    </main>
  )
}
