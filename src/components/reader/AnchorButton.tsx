'use client'
import { useEffect, useRef, useState } from 'react'
import { Anchor, Check, X } from 'lucide-react'
import { useReaderStore } from '@/store'
import { cn } from '@/lib/utils'

interface AnchorButtonProps {
  fanficId: string
  chapterId: string            // 'single' for single-chapter fics
  chapterTitle?: string
}

/**
 * ⚓ Anchor FAB — floating action button in the reader's bottom-right corner.
 *
 * Behaviours:
 *   - Click when no anchor exists     → sets anchor at current scroll
 *   - Click when anchor is HERE       → opens a mini popover with Update / Remove
 *   - Click when anchor is elsewhere  → sets anchor here (overwrites the old one,
 *                                       since only one anchor per fanfic)
 *
 * Distinct from the passive auto-scroll tracking (readingProgress) that runs
 * on every scroll — the anchor is what the "Продолжить с якоря" CTA on the
 * fanfic detail page and the /profile → Продолжить чтение tab consume.
 *
 * Position: fixed bottom-right, above scroll and content. Doesn't disappear
 * on scroll (which the previous top-bar placement did as soon as the sticky
 * header scrolled off the reader on mobile).
 */
export function AnchorButton({ fanficId, chapterId, chapterTitle }: AnchorButtonProps) {
  const setAnchor = useReaderStore(s => s.setAnchor)
  const clearAnchor = useReaderStore(s => s.clearAnchor)
  const anchor = useReaderStore(s => (s.anchors ?? {})[fanficId])
  const [flashSaved, setFlashSaved] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const hasAnchorHere = !!anchor && anchor.chapterId === chapterId
  const hasAnchorElsewhere = !!anchor && anchor.chapterId !== chapterId

  const doSave = () => {
    setAnchor({
      fanficId,
      chapterId,
      scrollY: window.scrollY,
      chapterTitle,
      updatedAt: Date.now(),
    })
    setFlashSaved(true)
    setMenuOpen(false)
    window.setTimeout(() => setFlashSaved(false), 1400)
  }

  const doRemove = () => {
    clearAnchor(fanficId)
    setMenuOpen(false)
  }

  const handleClick = () => {
    // If there IS an anchor for this exact chapter, opening the menu lets the
    // user choose Update / Remove instead of blindly overwriting.
    if (hasAnchorHere) {
      setMenuOpen(v => !v)
      return
    }
    // Anchor elsewhere in the fic, or none at all → just save/overwrite.
    doSave()
  }

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [menuOpen])

  return (
    <div
      ref={rootRef}
      className="fixed right-4 bottom-4 sm:right-6 sm:bottom-6 z-40 flex flex-col items-end"
    >
      {menuOpen && hasAnchorHere && (
        <div
          className={cn(
            'absolute right-0 bottom-full mb-2 min-w-[240px]',
            'rounded-xl bg-zinc-900/95 backdrop-blur',
            'border border-purple-800/50 shadow-2xl shadow-black/70 overflow-hidden',
          )}
        >
          <div className="px-3 py-2 border-b border-zinc-800 bg-purple-950/30">
            <p className="text-[11px] uppercase tracking-wider text-purple-300 font-medium">Якорь здесь</p>
            {anchor?.chapterTitle && (
              <p className="text-xs text-zinc-400 mt-0.5 truncate">{anchor.chapterTitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={doSave}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-zinc-100 hover:bg-purple-900/30 transition-colors"
          >
            <Anchor size={14} className="text-purple-400 fill-purple-400/30" />
            <span>Обновить положение</span>
          </button>
          <button
            type="button"
            onClick={doRemove}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-300 hover:bg-red-900/30 transition-colors border-t border-zinc-800"
          >
            <X size={14} />
            <span>Убрать якорь</span>
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={handleClick}
        title={
          flashSaved
            ? 'Якорь сохранён'
            : hasAnchorHere
              ? 'Здесь стоит якорь — нажми чтобы обновить или убрать'
              : hasAnchorElsewhere
                ? 'Заменить якорь на это место'
                : 'Поставить якорь на этом месте'
        }
        className={cn(
          'group flex items-center gap-2 rounded-full shadow-lg shadow-black/50 border transition-all',
          'px-4 py-3 text-sm font-medium',
          flashSaved
            ? 'bg-emerald-600 text-white border-emerald-500'
            : hasAnchorHere
              ? 'bg-purple-600 text-white border-purple-500 hover:bg-purple-500'
              : 'bg-zinc-900 text-zinc-200 border-zinc-700 hover:border-purple-500 hover:text-purple-200',
        )}
      >
        {flashSaved
          ? <Check size={16} />
          : <Anchor size={16} className={hasAnchorHere ? 'fill-white/30' : ''} />
        }
        <span className="hidden sm:inline">
          {flashSaved
            ? 'Сохранено'
            : hasAnchorHere
              ? 'Якорь здесь'
              : hasAnchorElsewhere
                ? 'Заменить якорь'
                : 'Поставить якорь'}
        </span>
      </button>
    </div>
  )
}
