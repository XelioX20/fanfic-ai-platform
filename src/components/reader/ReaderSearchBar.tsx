'use client'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react'
import { useReaderStore } from '@/store'
import { cn } from '@/lib/utils'

interface ReaderSearchBarProps {
  /**
   * CSS selector for the content root the bar searches inside.
   * Defaults to `.reader-content` — the div ReaderContent renders.
   */
  contentSelector?: string
}

const HIT_CLASS = 'reader-search-hit'
const CURRENT_CLASS = 'reader-search-hit-current'

/**
 * In-reader full-text search.
 *
 * Opens with the Search FAB (bottom-right of the reader, stacked above the
 * anchor FAB) or Ctrl/Cmd+F on desktop. Renders a sticky bar at the top of
 * the reader with an input, a match count ("3 из 12"), and prev/next
 * navigation. Escape closes.
 *
 * Highlighting: we walk every text node inside `contentSelector` and wrap
 * substring matches in <mark class="reader-search-hit">. The 'current' hit
 * gets an additional class and is scrolled into view. Highlights are torn
 * down and rebuilt each keystroke — cheap enough for chapter-sized bodies
 * (30-200k chars). Search is case-insensitive and locale-aware via
 * String.prototype.toLocaleLowerCase.
 *
 * Skipped by design:
 *   - regex mode (out of scope; the pattern used by ficbook readers is plain
 *     substring)
 *   - matching across paragraph breaks (each text node is searched
 *     independently, matching visible text on the page)
 */
export function ReaderSearchBar({ contentSelector = '.reader-content' }: ReaderSearchBarProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<HTMLElement[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const readerTheme = useReaderStore(s => s.settings.theme)
  const isLightReader = readerTheme === 'light' || readerTheme === 'sepia' || readerTheme === 'paper'

  const openBar = useCallback(() => {
    setOpen(true)
    // Focus input after mount
    window.setTimeout(() => inputRef.current?.focus(), 30)
  }, [])

  const closeBar = useCallback(() => {
    setOpen(false)
    setQuery('')
    setHits([])
    setCurrentIdx(0)
  }, [])

  // Keyboard: Ctrl/Cmd+F opens the bar (and prevents the browser one so we
  // stay consistent across reader themes); Escape closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isFind = (e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F' || e.key === 'а' || e.key === 'А')
      if (isFind) {
        e.preventDefault()
        openBar()
      } else if (e.key === 'Escape' && open) {
        e.preventDefault()
        closeBar()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, openBar, closeBar])

  // Rebuild highlights whenever the query changes.
  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.querySelector(contentSelector) as HTMLElement | null
    if (!root) return

    // Tear down previous highlights first (idempotent).
    for (const m of Array.from(root.querySelectorAll(`mark.${HIT_CLASS}`))) {
      const parent = m.parentNode
      if (!parent) continue
      while (m.firstChild) parent.insertBefore(m.firstChild, m)
      parent.removeChild(m)
      parent.normalize() // merge split text nodes
    }

    if (!open || !query.trim()) {
      setHits([])
      setCurrentIdx(0)
      return
    }

    const needle = query.toLocaleLowerCase()
    if (needle.length < 2) {
      // 1-char queries produce too much noise; require ≥2 chars.
      setHits([])
      setCurrentIdx(0)
      return
    }

    // Walk every text node inside the reader content root.
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        // Skip empty / whitespace-only text nodes to save work.
        return node.nodeValue && node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
      },
    })
    const textNodes: Text[] = []
    let n: Node | null
    while ((n = walker.nextNode())) textNodes.push(n as Text)

    const collected: HTMLElement[] = []
    for (const tn of textNodes) {
      const val = tn.nodeValue ?? ''
      const lowered = val.toLocaleLowerCase()
      let searchFrom = 0
      const spans: { start: number; end: number }[] = []
      while (true) {
        const idx = lowered.indexOf(needle, searchFrom)
        if (idx === -1) break
        spans.push({ start: idx, end: idx + needle.length })
        searchFrom = idx + needle.length
      }
      if (spans.length === 0) continue
      // Rebuild the text node: original slices + <mark> for each hit.
      const parent = tn.parentNode
      if (!parent) continue
      const frag = document.createDocumentFragment()
      let cursor = 0
      for (const s of spans) {
        if (s.start > cursor) frag.appendChild(document.createTextNode(val.slice(cursor, s.start)))
        const mark = document.createElement('mark')
        mark.className = HIT_CLASS
        mark.textContent = val.slice(s.start, s.end)
        frag.appendChild(mark)
        collected.push(mark)
        cursor = s.end
      }
      if (cursor < val.length) frag.appendChild(document.createTextNode(val.slice(cursor)))
      parent.replaceChild(frag, tn)
    }

    setHits(collected)
    setCurrentIdx(collected.length > 0 ? 0 : -1)
  }, [query, open, contentSelector])

  // Mark the 'current' hit + scroll it into view.
  useEffect(() => {
    hits.forEach((el, i) => {
      el.classList.toggle(CURRENT_CLASS, i === currentIdx)
    })
    if (currentIdx >= 0 && hits[currentIdx]) {
      hits[currentIdx].scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [currentIdx, hits])

  const goNext = useCallback(() => {
    if (hits.length === 0) return
    setCurrentIdx(i => (i + 1) % hits.length)
  }, [hits.length])

  const goPrev = useCallback(() => {
    if (hits.length === 0) return
    setCurrentIdx(i => (i - 1 + hits.length) % hits.length)
  }, [hits.length])

  // Cleanup highlights on unmount so a chapter change / route exit doesn't
  // leave <mark> wrappers behind.
  useEffect(() => {
    return () => {
      const root = document.querySelector(contentSelector)
      if (!root) return
      for (const m of Array.from(root.querySelectorAll(`mark.${HIT_CLASS}`))) {
        const parent = m.parentNode
        if (!parent) continue
        while (m.firstChild) parent.insertBefore(m.firstChild, m)
        parent.removeChild(m)
      }
    }
  }, [contentSelector])

  return (
    <>
      {/* Global styles for the highlight — keyed to the reader theme so the
          contrast stays legible on both light and dark backgrounds.
          Rendered as a plain <style> to avoid styled-jsx scoping the class. */}
      <style>{`
        mark.${HIT_CLASS} {
          background-color: rgba(250, 204, 21, 0.55);
          color: inherit;
          border-radius: 2px;
          padding: 0 1px;
        }
        mark.${CURRENT_CLASS} {
          background-color: rgba(249, 115, 22, 0.85);
          color: #fff;
          outline: 2px solid rgba(249, 115, 22, 0.9);
          outline-offset: 1px;
        }
      `}</style>

      {/* FAB — search icon. Stacks above the anchor FAB. */}
      {!open && (
        <button
          type="button"
          onClick={openBar}
          title="Поиск по тексту (Ctrl+F)"
          aria-label="Поиск по тексту"
          className={cn(
            'fixed right-4 bottom-24 sm:right-6 sm:bottom-24 z-40',
            'w-12 h-12 rounded-full flex items-center justify-center shadow-lg border transition-all',
            isLightReader
              ? 'bg-white text-zinc-800 border-zinc-300 shadow-black/20 hover:border-purple-500 hover:text-purple-700'
              : 'bg-zinc-900 text-zinc-100 border-zinc-700 shadow-black/50 hover:border-purple-500 hover:text-purple-200',
          )}
        >
          <Search size={18} />
        </button>
      )}

      {/* Search bar — pinned right under the reader's sticky top bar. */}
      {open && (
        <div
          className={cn(
            'sticky top-12 z-30 w-full backdrop-blur border-b',
            isLightReader
              ? 'bg-white/95 border-purple-200'
              : 'bg-zinc-900/95 border-zinc-800',
          )}
        >
          <div className="max-w-4xl mx-auto flex items-center gap-2 px-3 py-2">
            <Search
              size={16}
              className={isLightReader ? 'text-zinc-500' : 'text-zinc-400'}
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (e.shiftKey) goPrev()
                  else goNext()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  closeBar()
                }
              }}
              placeholder="Поиск в тексте главы"
              className={cn(
                'flex-1 min-w-0 bg-transparent outline-none text-sm',
                isLightReader
                  ? 'text-zinc-900 placeholder:text-zinc-500'
                  : 'text-zinc-100 placeholder:text-zinc-500',
              )}
            />
            <span
              className={cn(
                'text-xs tabular-nums px-1',
                query && hits.length === 0
                  ? 'text-red-400'
                  : isLightReader ? 'text-zinc-500' : 'text-zinc-400',
              )}
            >
              {query
                ? hits.length > 0
                  ? `${currentIdx + 1} / ${hits.length}`
                  : 'нет совпадений'
                : ''}
            </span>
            <button
              type="button"
              onClick={goPrev}
              disabled={hits.length === 0}
              title="Предыдущее совпадение (Shift+Enter)"
              aria-label="Предыдущее совпадение"
              className={cn(
                'p-1.5 rounded transition-colors',
                hits.length === 0 ? 'opacity-40 cursor-not-allowed' : '',
                isLightReader
                  ? 'hover:bg-zinc-100 text-zinc-700'
                  : 'hover:bg-zinc-800 text-zinc-300',
              )}
            >
              <ChevronUp size={16} />
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={hits.length === 0}
              title="Следующее совпадение (Enter)"
              aria-label="Следующее совпадение"
              className={cn(
                'p-1.5 rounded transition-colors',
                hits.length === 0 ? 'opacity-40 cursor-not-allowed' : '',
                isLightReader
                  ? 'hover:bg-zinc-100 text-zinc-700'
                  : 'hover:bg-zinc-800 text-zinc-300',
              )}
            >
              <ChevronDown size={16} />
            </button>
            <button
              type="button"
              onClick={closeBar}
              title="Закрыть (Esc)"
              aria-label="Закрыть поиск"
              className={cn(
                'p-1.5 rounded transition-colors',
                isLightReader
                  ? 'hover:bg-zinc-100 text-zinc-700'
                  : 'hover:bg-zinc-800 text-zinc-300',
              )}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
