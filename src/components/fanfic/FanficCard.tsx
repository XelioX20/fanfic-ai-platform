'use client'
import Link from 'next/link'
import Image from 'next/image'
import { Heart, Trophy, BookOpen, MessageSquare } from 'lucide-react'
import type { Fanfic } from '@/types'
import { Badge } from '@/components/ui/badge'
import { cn, formatWordCount, formatNumber, truncate } from '@/lib/utils'

interface FanficCardProps {
  fanfic: Fanfic
  compact?: boolean
  className?: string
}

function DirectionBadge({ direction }: { direction: string }) {
  return <Badge variant="direction">{direction}</Badge>
}

function RatingBadge({ rating }: { rating: string }) {
  return <Badge variant="rating">{rating}</Badge>
}

function StatusBadge({ status }: { status: string }) {
  const label = status === 'Завершён' ? '✓ Завершён' : status === 'В процессе' ? '⟳ В процессе' : '❄ Заморожен'
  return <Badge variant="status">{label}</Badge>
}

export function FanficCard({ fanfic, compact = false, className }: FanficCardProps) {
  return (
    <Link href={`/fanfic/${fanfic.id}`} className={cn('block', className)}>
      <article className="group bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-purple-700/50 hover:bg-zinc-800/50 transition-all">
        <div className="flex gap-4">
          {fanfic.cover_url && !compact && (
            <div className="flex-shrink-0 w-16 h-24 relative rounded overflow-hidden">
              <Image src={fanfic.cover_url} alt={fanfic.title} fill className="object-cover" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-zinc-100 group-hover:text-purple-400 transition-colors line-clamp-2 mb-1">
              {fanfic.title}
            </h3>
            <p className="text-sm text-zinc-400 mb-2">
              {fanfic.fandoms.join(', ')} · {fanfic.author_name}
            </p>
            {fanfic.description && !compact && (
              <p className="text-sm text-zinc-500 line-clamp-2 mb-3">
                {truncate(fanfic.description, 200)}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5 mb-3">
              <DirectionBadge direction={fanfic.direction} />
              <RatingBadge rating={fanfic.rating} />
              <StatusBadge status={fanfic.completion_status} />
              {fanfic.is_hot && <Badge variant="hot">🔥 Горячее</Badge>}
            </div>
            <div className="flex items-center gap-4 text-xs text-zinc-500">
              <span className="flex items-center gap-1">
                <BookOpen size={12} />
                {formatWordCount(fanfic.words_count)} слов
              </span>
              <span className="flex items-center gap-1">
                <Heart size={12} />
                {formatNumber(fanfic.likes)}
              </span>
              <span className="flex items-center gap-1">
                <Trophy size={12} />
                {formatNumber(fanfic.trophies)}
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare size={12} />
                {formatNumber(fanfic.comments_count)}
              </span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  )
}
