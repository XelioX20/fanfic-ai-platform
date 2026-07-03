'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Heart, Trophy } from 'lucide-react'
import type { Fanfic } from '@/types'
import { cn, formatNumber } from '@/lib/utils'
import { FanficStateBadges } from './FanficStateBadges'

const DIRECTION_COLORS: Record<string, string> = {
  'Слэш':     'bg-blue-800/80 text-blue-200 border-blue-600/60',
  'Гет':      'bg-pink-800/80 text-pink-200 border-pink-600/60',
  'Джен':     'bg-green-800/80 text-green-200 border-green-600/60',
  'Фемслэш':  'bg-purple-800/80 text-purple-200 border-purple-600/60',
  'Смешанное':'bg-yellow-800/80 text-yellow-200 border-yellow-600/60',
  'Другое':   'bg-zinc-700/80 text-zinc-200 border-zinc-500/60',
}

const RATING_COLORS: Record<string, string> = {
  'G':     'bg-emerald-800/80 text-emerald-200 border-emerald-600/60',
  'PG-13': 'bg-yellow-800/80 text-yellow-200 border-yellow-600/60',
  'R':     'bg-orange-800/80 text-orange-200 border-orange-600/60',
  'NC-17': 'bg-red-800/80 text-red-200 border-red-600/60',
  'NC-21': 'bg-red-900/90 text-red-200 border-red-700/80',
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
  const router = useRouter()
  const pairings = fanfic.pairings ?? []
  const tags = fanfic.tags ?? []
  const fandoms = fanfic.fandoms ?? []
  const hasCover = !!fanfic.cover_url

  return (
    <article className={cn(
      'relative bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden',
      'hover:border-zinc-600/70 transition-colors duration-150',
      className
    )}>
      <FanficStateBadges fanficId={fanfic.id} />

      <div className="flex flex-col sm:flex-row-reverse gap-4 p-4">
        {/* Cover on the RIGHT (ficbook style) — natural aspect ratio */}
        {hasCover && (
          <Link
            href={`/fanfic/${fanfic.id}`}
            className="flex-shrink-0 w-full sm:w-[120px] block"
          >
            <div className="relative w-full sm:w-[120px] sm:aspect-[3/4] bg-zinc-800 rounded overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fanfic.cover_url!}
                alt={fanfic.title}
                className="w-full h-auto sm:absolute sm:inset-0 sm:w-full sm:h-full sm:object-cover hover:opacity-90 transition-opacity block"
                loading="lazy"
              />
            </div>
          </Link>
        )}

        {/* Left content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <Link href={`/fanfic/${fanfic.id}`}>
            <h3 className="font-bold text-lg text-zinc-100 hover:text-purple-400 transition-colors mb-2 leading-tight">
              {fanfic.title}
            </h3>
          </Link>

          {/* Badges + inline action buttons */}
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            {fanfic.direction && fanfic.direction !== 'Неизвестно' && (
              <Chip
                className={DIRECTION_COLORS[fanfic.direction] ?? 'bg-zinc-700/60 text-zinc-300 border-zinc-600/40'}
                onClick={() => router.push(`/search?q=${encodeURIComponent(fanfic.direction)}`)}
              >
                {fanfic.direction}
              </Chip>
            )}
            {fanfic.rating && fanfic.rating !== 'Неизвестно' && (
              <Chip className={RATING_COLORS[fanfic.rating] ?? 'bg-zinc-700/60 text-zinc-300 border-zinc-600/40'}>
                {fanfic.rating}
              </Chip>
            )}
            {fanfic.completion_status && fanfic.completion_status !== 'Неизвестно' && (
              <Chip
                className={
                  fanfic.completion_status === 'Завершён'
                    ? 'bg-teal-900/60 text-teal-300 border-teal-700/40'
                    : fanfic.completion_status === 'Заморожен'
                    ? 'bg-sky-900/60 text-sky-300 border-sky-700/40'
                    : 'bg-zinc-700/60 text-zinc-400 border-zinc-600/40'
                }
                onClick={() => router.push(`/search?q=${encodeURIComponent(fanfic.completion_status)}`)}
              >
                {STATUS_ICONS[fanfic.completion_status] ?? ''} {fanfic.completion_status}
              </Chip>
            )}
            {fanfic.likes > 0 && (
              <Chip className="bg-zinc-800 text-zinc-400 border-zinc-700/40">
                <Heart size={10} className="mr-1" />{formatNumber(fanfic.likes)}
              </Chip>
            )}
            {fanfic.trophies > 0 && (
              <Chip className="bg-zinc-800 text-zinc-400 border-zinc-700/40">
                <Trophy size={10} className="mr-1" />{formatNumber(fanfic.trophies)}
              </Chip>
            )}
            {fanfic.is_hot && (
              <Chip className="bg-orange-900/60 text-orange-300 border-orange-700/40">
                🔥 Горячая работа
              </Chip>
            )}
          </div>

          {/* Metadata rows — ficbook style */}
          <div className="space-y-1 text-sm mb-2">
            {fanfic.author_name && (
              <div>
                <span className="text-zinc-500">Автор: </span>
                <span className="text-zinc-300">{fanfic.author_name}</span>
              </div>
            )}
            {fandoms.length > 0 && (
              <div>
                <span className="text-zinc-500">Фэндом: </span>
                {fandoms.map((fandom, i) => (
                  <span key={i}>
                    {i > 0 && <span className="text-zinc-500">, </span>}
                    <Link href={`/search?q=${encodeURIComponent(fandom)}`} className="text-zinc-300 hover:text-purple-400 transition-colors">
                      {fandom}
                    </Link>
                  </span>
                ))}
              </div>
            )}
            {pairings.length > 0 && (
              <div>
                <span className="text-zinc-500">Пэйринг и персонажи: </span>
                {pairings.map((p, i) => (
                  <span key={i}>
                    {i > 0 && <span className="text-zinc-500">, </span>}
                    <Link
                      href={`/search?q=${encodeURIComponent(p.characters.join('/'))}`}
                      className={cn('transition-colors', p.is_highlight ? 'text-purple-400 hover:text-purple-300' : 'text-zinc-300 hover:text-purple-400')}
                    >
                      {p.characters.join('/')}
                    </Link>
                  </span>
                ))}
              </div>
            )}
            {fanfic.size && (
              <div>
                <span className="text-zinc-500">Размер: </span>
                <span className="text-zinc-300">{fanfic.size}</span>
              </div>
            )}
            {fanfic.update_date && (
              <div>
                <span className="text-zinc-500">Дата обновления: </span>
                <span className="text-zinc-300">{fanfic.update_date}</span>
              </div>
            )}
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="mb-2">
              <span className="text-zinc-500 text-sm">Метки: </span>
              <span className="inline-flex flex-wrap gap-1 align-middle">
                {tags.slice(0, 20).map((tag, i) => (
                  <TagChip key={i} name={tag.name} isAdult={tag.is_adult} />
                ))}
                {tags.length > 20 && (
                  <span className="text-xs text-zinc-600 self-center px-1">+{tags.length - 20}</span>
                )}
              </span>
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
