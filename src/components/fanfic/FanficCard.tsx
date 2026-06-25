'use client'
import Link from 'next/link'
import Image from 'next/image'
import { Heart, Trophy, BookOpen, MessageSquare, Clock, User } from 'lucide-react'
import type { Fanfic } from '@/types'
import { cn, formatWordCount, formatNumber } from '@/lib/utils'

// Direction color map matching ficbook.net style
const DIRECTION_COLORS: Record<string, string> = {
  'Слэш':     'bg-blue-900/60 text-blue-300 border-blue-700/40',
  'Гет':      'bg-pink-900/60 text-pink-300 border-pink-700/40',
  'Джен':     'bg-green-900/60 text-green-300 border-green-700/40',
  'Фемслэш':  'bg-purple-900/60 text-purple-300 border-purple-700/40',
  'Смешанное':'bg-yellow-900/60 text-yellow-300 border-yellow-700/40',
  'Другое':   'bg-zinc-700/60 text-zinc-300 border-zinc-600/40',
}

const RATING_COLORS: Record<string, string> = {
  'G':     'bg-emerald-900/60 text-emerald-300 border-emerald-700/40',
  'PG-13': 'bg-yellow-900/60 text-yellow-300 border-yellow-700/40',
  'R':     'bg-orange-900/60 text-orange-300 border-orange-700/40',
  'NC-17': 'bg-red-900/60 text-red-300 border-red-700/40',
  'NC-21': 'bg-red-950/80 text-red-400 border-red-800/60',
}

const STATUS_ICONS: Record<string, string> = {
  'Завершён':   '✓',
  'В процессе': '⟳',
  'Заморожен':  '❄',
}

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border',
      className
    )}>
      {children}
    </span>
  )
}

function DirectionChip({ direction }: { direction: string }) {
  if (!direction || direction === 'Неизвестно') return null
  return <Chip className={DIRECTION_COLORS[direction] ?? 'bg-zinc-700/60 text-zinc-300 border-zinc-600/40'}>{direction}</Chip>
}

function RatingChip({ rating }: { rating: string }) {
  if (!rating || rating === 'Неизвестно') return null
  return <Chip className={RATING_COLORS[rating] ?? 'bg-zinc-700/60 text-zinc-300 border-zinc-600/40'}>{rating}</Chip>
}

function StatusChip({ status }: { status: string }) {
  if (!status || status === 'Неизвестно') return null
  const icon = STATUS_ICONS[status] ?? ''
  const color = status === 'Завершён'
    ? 'bg-teal-900/60 text-teal-300 border-teal-700/40'
    : status === 'Заморожен'
    ? 'bg-sky-900/60 text-sky-300 border-sky-700/40'
    : 'bg-zinc-700/60 text-zinc-400 border-zinc-600/40'
  return <Chip className={color}>{icon} {status}</Chip>
}

function HotChip() {
  return <Chip className="bg-orange-900/60 text-orange-300 border-orange-700/40">🔥 Горячая работа</Chip>
}

function TagChip({ name, isAdult }: { name: string; isAdult: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-xs border',
      isAdult
        ? 'bg-red-950/40 text-red-400 border-red-800/40'
        : 'bg-zinc-800 text-zinc-400 border-zinc-700/40 hover:border-zinc-500/60 hover:text-zinc-300'
    )}>
      {name}
      {isAdult && <span className="ml-1 text-red-500 font-bold">18+</span>}
    </span>
  )
}

interface FanficCardProps {
  fanfic: Fanfic
  className?: string
}

export function FanficCard({ fanfic, className }: FanficCardProps) {
  const pairings = fanfic.pairings ?? []
  const tags = fanfic.tags ?? []
  const fandoms = fanfic.fandoms ?? []
  const hasCover = !!fanfic.cover_url

  return (
    <article className={cn(
      'bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden',
      'hover:border-zinc-600/70 transition-colors duration-150',
      className
    )}>
      <div className="flex gap-0">
        {/* Cover */}
        {hasCover && (
          <div className="flex-shrink-0 w-[120px] relative self-stretch min-h-[160px]">
            <Image
              src={fanfic.cover_url!}
              alt={fanfic.title}
              fill
              className="object-cover"
              sizes="120px"
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0 p-4">
          {/* Status badges row */}
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <DirectionChip direction={fanfic.direction} />
            <RatingChip rating={fanfic.rating} />
            <StatusChip status={fanfic.completion_status} />
            {fanfic.likes > 0 && (
              <Chip className="bg-zinc-800 text-zinc-400 border-zinc-700/40">
                <Heart size={10} className="mr-1" />{formatNumber(fanfic.likes)}
              </Chip>
            )}
            {fanfic.is_hot && <HotChip />}
          </div>

          {/* Title */}
          <Link href={fanfic.ficbook_url} target="_blank" rel="noopener noreferrer">
            <h3 className="font-bold text-zinc-100 hover:text-purple-400 transition-colors mb-1.5 leading-snug">
              {fanfic.title}
            </h3>
          </Link>

          {/* Author */}
          <div className="flex items-center gap-1 text-sm text-zinc-400 mb-1.5">
            <User size={12} className="text-zinc-500" />
            <span>{fanfic.author_name}</span>
          </div>

          {/* Fandom */}
          {fandoms.length > 0 && (
            <div className="text-sm text-zinc-500 mb-1.5">
              <span className="text-zinc-600">Фэндом: </span>
              <span className="text-zinc-400">{fandoms.join(', ')}</span>
            </div>
          )}

          {/* Pairings */}
          {pairings.length > 0 && (
            <div className="text-sm text-zinc-500 mb-2">
              <span className="text-zinc-600">Пэйринг и персонажи: </span>
              <span className="text-zinc-400">
                {pairings.map((p, i) => (
                  <span key={i}>
                    {i > 0 && ', '}
                    <span className={p.is_highlight ? 'text-purple-400' : ''}>
                      {p.characters.join('/')}
                    </span>
                  </span>
                ))}
              </span>
            </div>
          )}

          {/* Size info */}
          <div className="flex items-center gap-3 text-xs text-zinc-500 mb-2">
            {fanfic.words_count > 0 && (
              <span className="flex items-center gap-1">
                <BookOpen size={11} />
                {formatWordCount(fanfic.words_count)} слов
              </span>
            )}
            {fanfic.chapters_count > 0 && (
              <span>{fanfic.chapters_count} {fanfic.chapters_count === 1 ? 'глава' : 'глав'}</span>
            )}
            {fanfic.trophies > 0 && (
              <span className="flex items-center gap-1">
                <Trophy size={11} />
                {formatNumber(fanfic.trophies)}
              </span>
            )}
            {fanfic.comments_count > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare size={11} />
                {formatNumber(fanfic.comments_count)}
              </span>
            )}
            {fanfic.updated_at && (
              <span className="flex items-center gap-1 ml-auto">
                <Clock size={11} />
                {new Date(fanfic.updated_at).toLocaleDateString('ru-RU')}
              </span>
            )}
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {tags.slice(0, 12).map((tag, i) => (
                <TagChip key={i} name={tag.name} isAdult={tag.is_adult} />
              ))}
              {tags.length > 12 && (
                <span className="text-xs text-zinc-600 self-center">+{tags.length - 12}</span>
              )}
            </div>
          )}

          {/* Description */}
          {fanfic.description && (
            <p className="text-sm text-zinc-400 leading-relaxed line-clamp-3 mt-2 border-t border-zinc-800 pt-2">
              {fanfic.description}
            </p>
          )}
        </div>
      </div>
    </article>
  )
}
