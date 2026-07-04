'use client'
import { useState } from 'react'
import { Anchor, Check } from 'lucide-react'
import { useReaderStore } from '@/store'
import { cn } from '@/lib/utils'

interface AnchorButtonProps {
  fanficId: string
  chapterId: string            // 'single' for single-chapter fics
  chapterTitle?: string
  className?: string
}

/**
 * "⚓ Поставь якорь" — one-tap explicit save of the current position.
 *
 * Distinct from the implicit auto-save that ReaderContent does on every
 * scroll (see readingProgress). Anchors are what the fanfic detail page
 * exposes as "Продолжить с последнего места" — a deliberate, user-visible
 * mark, not a heuristic.
 *
 * Behaviour: click sets/replaces the anchor for this fanfic at the current
 * scrollY of the chapter you're reading. If an anchor already exists for
 * this fic, the click overwrites it (only one anchor per fic — simple
 * model, no anchor list to manage).
 */
export function AnchorButton({ fanficId, chapterId, chapterTitle, className }: AnchorButtonProps) {
  const setAnchor = useReaderStore(s => s.setAnchor)
  const anchor = useReaderStore(s => s.anchors[fanficId])
  const [flashSaved, setFlashSaved] = useState(false)

  const hasAnchorHere = !!anchor && anchor.chapterId === chapterId

  const handleClick = () => {
    setAnchor({
      fanficId,
      chapterId,
      scrollY: window.scrollY,
      chapterTitle,
      updatedAt: Date.now(),
    })
    setFlashSaved(true)
    window.setTimeout(() => setFlashSaved(false), 1400)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={
        flashSaved
          ? 'Якорь сохранён'
          : hasAnchorHere
            ? 'Обновить якорь на этом месте'
            : 'Поставить якорь на этом месте'
      }
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg text-xs font-medium transition-all',
        'px-2.5 py-1.5 border',
        flashSaved
          ? 'bg-emerald-900/70 text-emerald-200 border-emerald-600/60'
          : hasAnchorHere
            ? 'bg-purple-900/50 text-purple-200 border-purple-600/50 hover:bg-purple-800/60'
            : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-purple-700/60 hover:text-purple-300',
        className,
      )}
    >
      {flashSaved
        ? <Check size={14} />
        : <Anchor size={14} className={hasAnchorHere ? 'fill-purple-300/40' : ''} />
      }
      <span className="hidden sm:inline">
        {flashSaved ? 'Сохранено' : hasAnchorHere ? 'Якорь ⚑' : 'Якорь'}
      </span>
    </button>
  )
}
