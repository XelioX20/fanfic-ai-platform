'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Heart, Trophy, BookOpen, MessageSquare, Clock, User } from 'lucide-react'
import type { Fanfic } from '@/types'
import { cn, formatWordCount, formatNumber } from '@/lib/utils'

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

function Chip({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <span
      onClick={onClick}
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border',
        onClick && 'cursor-pointer hover:opacity-80 transition-opacity',
        className
      )}
    >
      {children}
    </span>
  )
}

function DirectionChip({ direction }: { direction: string }) {
  const router = useRouter()
  if (!direction || direction === 'Неизвестно') return null
  return (
    <Chip
      className={DIRECTION_COLORS[direction] ?? 'bg-zinc-700/60 text-zinc-300 border-zinc-600/40'}
      onClick={() => router.push(`/search?q=${encodeURIComponent(direction)}`)}
    >
      {direction}
    </Chip>
  )
}

function RatingChip({ rating }: { rating: string }) {
  if (!rating || rating === 'Неизвестно') return null
  return <Chip className={RATING_COLORS[rating] ?? 'bg-zinc-700/60 text-zinc-300 border-zinc-600/40'}>{rating}</Chip>
}

function StatusChip({ status }: { status: string }) {
  const router = useRouter()
  if (!status || status === 'Неизвестно') return null
  const icon = STATUS_ICONS[status] ?? ''
  const color = status === 'Завершён'
    ? 'bg-teal-900/60 text-teal-300 border-teal-700/40'
    : status === 'Заморожен'
    ? 'bg-sky-900/60 text-sky-300 border-sky-700/40'
    : 'bg-zinc-700/60 text-zinc-400 border-zinc-600/40'
  return (
    <Chip
      className={color}
      onClick={() => router.push(`/search?q=${encodeURIComponent(status)}`)}
    >
      {icon} {status}
    </Chip>
  )
}

function HotChip() {
  return <Chip className="bg-orange-900/60 text-orange-300 border-orange-700/40">🔥 Горячая работа</Chip>
}

function TagChip({ name, isAdult }: { name: string; isAdult: boolean }) {
  const router = useRouter()
  return (
    <span
      onClick={() => router.push(`/search?q=${encodeURIComponent(name)}`)}
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs border cursor-pointer transition-all',
        isAdult
          ? 'bg-red-950/40 text-red-400 border-red-800/40 hover:bg-red-900/50'
          : 'bg-zinc-800 text-zinc-400 border-zinc-700/40 hover:border-zinc-500/60 hover:text-zinc-200 hover:bg-zinc-700/50'
      )}
    >
      {name}
      {isAdult && <span className="ml-1 text-red-500 font-bold text-[10px]">18+</span>}
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
      <div className="flex">
        {hasCover && (
          <Link
            href={fanfic.ficbook_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 w-[120px] relative self-stretch min-h-[160px] block bg-zinc-800"
          >
            <Image
              src={fanfic.cover_url!}
              alt={fanfic.title}
              fill
              className="object-cover hover:opacity-90 transition-opacity"
              sizes="120px"
              unoptimized
            />
          </Link>
        )}

        <div className="flex-1 min-w-0 p-4">
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

          <Link href={`/fanfic/${fanfic.id}`}>
            <h3 className="font-bold text-zinc-100 hover:text-purple-400 transition-colors mb-1.5 leading-snug">
              {fanfic.title}
            </h3>
          </Link>

          <div className="flex items-center gap-1 text-sm text-zinc-400 mb-1.5">
            <User size={12} className="text-zinc-500" />
            <span>{fanfic.author_name}</span>
          </div>

          {fandoms.length > 0 && (
            <div className="text-sm mb-1.5">
              <span className="text-zinc-600">Фэндом: </span>
              {fandoms.map((fandom, i) => (
                <span key={i}>
                  {i > 0 && <span className="text-zinc-600">, </span>}
                  <Link href={`/search?q=${encodeURIComponent(fandom)}`} className="text-zinc-400 hover:text-purple-400 transition-colors">
                    {fandom}
                  </Link>
                </span>
              ))}
            </div>
          )}

          {pairings.length > 0 && (
            <div className="text-sm mb-2">
              <span className="text-zinc-600">Пэйринг и персонажи: </span>
              {pairings.map((p, i) => (
                <span key={i}>
                  {i > 0 && <span className="text-zinc-600">, </span>}
                  <Link
                    href={`/search?q=${encodeURIComponent(p.characters.join('/'))}`}
                    className={cn('transition-colors', p.is_highlight ? 'text-purple-400 hover:text-purple-300' : 'text-zinc-400 hover:text-purple-400')}
                  >
                    {p.characters.join('/')}
                  </Link>
                </span>
              ))}
            </div>
          )}

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {tags.slice(0, 15).map((tag, i) => (
                <TagChip key={i} name={tag.name} isAdult={tag.is_adult} />
              ))}
              {tags.length > 15 && (
                <span className="text-xs text-zinc-600 self-center px-1">+{tags.length - 15}</span>
              )}
            </div>
          )}

          <div className="flex items-center flex-wrap gap-3 text-xs text-zinc-500">
            {fanfic.words_count > 0 && (
              <span className="flex items-center gap-1"><BookOpen size={11} />{formatWordCount(fanfic.words_count)} слов</span>
            )}
            {fanfic.chapters_count > 0 && (
              <span>{fanfic.chapters_count} {fanfic.chapters_count === 1 ? 'глава' : 'глав'}</span>
            )}
            {fanfic.trophies > 0 && (
              <span className="flex items-center gap-1"><Trophy size={11} />{formatNumber(fanfic.trophies)}</span>
            )}
            {fanfic.comments_count > 0 && (
              <span className="flex items-center gap-1"><MessageSquare size={11} />{formatNumber(fanfic.comments_count)}</span>
            )}
            {fanfic.updated_at && (
              <span className="flex items-center gap-1 ml-auto"><Clock size={11} />{new Date(fanfic.updated_at).toLocaleDateString('ru-RU')}</span>
            )}
          </div>

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
