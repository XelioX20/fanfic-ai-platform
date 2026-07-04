'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { X, ChevronUp, ChevronDown } from 'lucide-react'
import { useReaderStore } from '@/store'
import { cn } from '@/lib/utils'

interface ReaderSearchBarProps {
  /** CSS selector for the content root. Defaults to `.reader-content`. */
  contentSelector?: string
  /**
   * Controlled open state — set by the topbar Search button.
   * When provided, the component has no internal toggle.
   */
  open: boolean
  onClose: () => void
}

const HIT_CLASS = 'reader-search-hit'
const CURRENT_CLASS = 'reader-search-hit-current'

export function ReaderSearchBar({ contentSelector = '.reader-content', open, onClose }: ReaderSearchBarProps) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<HTMLElement[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const readerTheme = useReaderStore(s => s.settings.theme)
  const isLightReader = readerTheme === 'light' || readerTheme === 'sepia' || readerTheme === 'paper'

  // Match search-bar background to the reader theme so there's no bright
  // stripe between the sticky topbar and the reader content on sepia/paper.
  const searchBarBg = (() => {
    switch (readerTheme) {
      case 'light':  return { bg: 'rgba(255,255,255,0.95)', border: '#e4e4e7' }
      case 'sepia':  return { bg: 'rgba(244,236,216,0.95)', border: '#d8ceb5' }
      case 'paper':  return { bg: 'rgba(250,247,242,0.95)', border: '#e5e2dc' }
      case 'amoled': return { bg: 'rgba(0,0,0,0.97)',       border: '#1f1f1f' }
      default:       return { bg: 'rgba(26,26,26,0.95)',    border: '#27272a' }
    }
  })()

  const closeBar = useCallback(() => {
    setQuery('')
    setHits([])
    setCurrentIdx(0)
    onClose()
  }, [onClose])

  // Focus input when opened
  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 30)
  }, [open])

  // Keyboard: Ctrl/Cmd+F, Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isFind = (e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F' || e.key === 'а' || e.key === 'А')
      if (isFind) { e.preventDefault(); if (!open) { /* parent handles open */ } return }
      if (e.key === 'Escape' && open) { e.preventDefault(); closeBar() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, closeBar])

  // Rebuild highlights
  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.querySelector(contentSelector) as HTMLElement | null
    if (!root) return
    for (const m of Array.from(root.querySelectorAll(`mark.${HIT_CLASS}`))) {
      const parent = m.parentNode
      if (!parent) continue
      while (m.firstChild) parent.insertBefore(m.firstChild, m)
      parent.removeChild(m)
      parent.normalize()
    }
    if (!open || !query.trim()) { setHits([]); setCurrentIdx(0); return }
    const needle = query.toLocaleLowerCase()
    if (needle.length < 2) { setHits([]); setCurrentIdx(0); return }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) { return node.nodeValue && node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT },
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

  useEffect(() => {
    hits.forEach((el, i) => el.classList.toggle(CURRENT_CLASS, i === currentIdx))
    if (currentIdx >= 0 && hits[currentIdx]) hits[currentIdx].scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [currentIdx, hits])

  const goNext = useCallback(() => { if (hits.length) setCurrentIdx(i => (i + 1) % hits.length) }, [hits.length])
  const goPrev = useCallback(() => { if (hits.length) setCurrentIdx(i => (i - 1 + hits.length) % hits.length) }, [hits.length])

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

  if (!open) return (
    <style>{`
      mark.${HIT_CLASS} { background-color: rgba(250,204,21,0.55); color: inherit; border-radius: 2px; padding: 0 1px; }
      mark.${CURRENT_CLASS} { background-color: rgba(249,115,22,0.85); color: #fff; outline: 2px solid rgba(249,115,22,0.9); outline-offset: 1px; }
    `}</style>
  )

  return (
    <>
      <style>{`
        mark.${HIT_CLASS} { background-color: rgba(250,204,21,0.55); color: inherit; border-radius: 2px; padding: 0 1px; }
        mark.${CURRENT_CLASS} { background-color: rgba(249,115,22,0.85); color: #fff; outline: 2px solid rgba(249,115,22,0.9); outline-offset: 1px; }
      `}</style>
      {/* Search bar directly below the sticky topbar */}
      <div
        className="sticky top-[52px] z-30 w-full backdrop-blur border-b"
        style={{ backgroundColor: searchBarBg.bg, borderColor: searchBarBg.border }}
      >
        <div className="max-w-4xl mx-auto flex items-center gap-2 px-3 py-2">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); if (e.shiftKey) goPrev(); else goNext() }
              else if (e.key === 'Escape') { e.preventDefault(); closeBar() }
            }}
            placeholder="Поиск в тексте главы..."
            aria-label="Поиск в тексте главы"
            className={cn(
              'flex-1 min-w-0 bg-transparent outline-none text-sm',
              isLightReader ? 'text-zinc-900 placeholder:text-zinc-500' : 'text-zinc-100 placeholder:text-zinc-500',
            )}
          />
          <span className={cn('text-xs tabular-nums px-1 shrink-0',
            query && hits.length === 0 ? 'text-red-400' : isLightReader ? 'text-zinc-500' : 'text-zinc-400',
          )}>
            {query ? (hits.length > 0 ? `${currentIdx + 1} / ${hits.length}` : 'нет') : ''}
          </span>
          <button type="button" onClick={goPrev} disabled={hits.length === 0} title="Предыдущее (Shift+Enter)"
            className={cn('p-1.5 rounded transition-colors', hits.length === 0 ? 'opacity-40 cursor-not-allowed' : '', isLightReader ? 'hover:bg-zinc-100 text-zinc-700' : 'hover:bg-zinc-800 text-zinc-300')}>
            <ChevronUp size={16} />
          </button>
          <button type="button" onClick={goNext} disabled={hits.length === 0} title="Следующее (Enter)"
            className={cn('p-1.5 rounded transition-colors', hits.length === 0 ? 'opacity-40 cursor-not-allowed' : '', isLightReader ? 'hover:bg-zinc-100 text-zinc-700' : 'hover:bg-zinc-800 text-zinc-300')}>
            <ChevronDown size={16} />
          </button>
          <button type="button" onClick={closeBar} title="Закрыть (Esc)"
            className={cn('p-1.5 rounded transition-colors', isLightReader ? 'hover:bg-zinc-100 text-zinc-700' : 'hover:bg-zinc-800 text-zinc-300')}>
            <X size={16} />
          </button>
        </div>
      </div>
    </>
  )
}

