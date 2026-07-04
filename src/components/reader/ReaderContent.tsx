'use client'
import { useEffect, useRef } from 'react'
import { useReaderStore } from '@/store'
import { cn } from '@/lib/utils'
import { getFontCssVar } from '@/lib/fonts'

interface ReaderContentProps {
  content: string
  chapterTitle?: string
  progressKey?: string  // e.g. `${fanficId}:${chapterId}` — enables position save/restore
  /**
   * If provided AND the anchor matches this fanfic + chapter, restore scroll
   * to the anchor's scrollY instead of the auto-tracked reading position.
   * Set by reader pages when they detect a `?anchor=1` search param.
   */
  restoreFromAnchor?: boolean
  anchorFanficId?: string
  anchorChapterId?: string
}

function formatChapterHtml(html: string): string {
  // Fix image URLs
  let result = html
    .replace(/src="\/\//g, 'src="https://')
    .replace(/src="\//g, 'src="https://ficbook.net/')

  // ficbook sends text as bare text nodes separated by \r\n\r\n inside a div.
  // Convert double newlines to paragraph breaks matching ficbook.net style.
  // Only do this when the content lacks proper <p> tags (has \r\n\r\n breaks).
  if (result.includes('\r\n\r\n') || result.includes('\n\n')) {
    // Extract inner content from the wrapper div if present
    const innerMatch = result.match(/^<div[^>]*>([\s\S]*)<\/div>$/)
    const inner = innerMatch ? innerMatch[1] : result

    // Split on double newlines, wrap each non-empty chunk in a <p>
    const paragraphs = inner
      .split(/\r?\n\r?\n/)
      .map(p => p.replace(/^\s+|\s+$/g, ''))
      .filter(p => p.length > 0)
      .map(p => {
        // Already a block element — don't double-wrap
        if (/^<(p|div|h[1-6]|blockquote|ul|ol|pre|hr)/i.test(p)) return p
        // Single newlines inside paragraph → <br>
        return `<p>${p.replace(/\r?\n/g, '<br>')}</p>`
      })
      .join('\n')

    result = innerMatch
      ? result.replace(innerMatch[1], paragraphs)
      : paragraphs
  }

  return result
}

export function ReaderContent({ content, chapterTitle, progressKey, restoreFromAnchor, anchorFanficId, anchorChapterId }: ReaderContentProps) {
  const { settings, readingProgress, setReadingProgress, anchors } = useReaderStore()
  const contentRef = useRef<HTMLDivElement>(null)

  const theme = settings.theme
  const processedContent = formatChapterHtml(content)

  // Restore scroll position when chapter loads.
  //
  // Priority order:
  //   1. Anchor for this fanfic+chapter, if the caller asked for anchor restore
  //      (i.e. user came in via "Продолжить с якоря" and the anchor targets
  //      this exact chapter).
  //   2. Otherwise, auto-tracked reading position.
  //   3. Otherwise, top of chapter.
  useEffect(() => {
    if (!progressKey) return

    const anchor = anchorFanficId ? anchors[anchorFanficId] : undefined
    const anchorMatchesHere =
      restoreFromAnchor && anchor && anchor.chapterId === anchorChapterId

    if (anchorMatchesHere && anchor.scrollY > 0) {
      const t = setTimeout(() => window.scrollTo({ top: anchor.scrollY, behavior: 'auto' }), 50)
      return () => clearTimeout(t)
    }

    const saved = readingProgress[progressKey]
    // Legacy entries are plain numbers; new ones are { scrollY, updatedAt }.
    const scrollY = typeof saved === 'number' ? saved : (saved?.scrollY ?? 0)
    if (scrollY > 100) {
      const t = setTimeout(() => window.scrollTo({ top: scrollY, behavior: 'auto' }), 50)
      return () => clearTimeout(t)
    }
    window.scrollTo(0, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressKey, restoreFromAnchor])

  // Save scroll position (throttled)
  useEffect(() => {
    if (!progressKey) return
    let raf = 0
    let lastSave = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const now = Date.now()
        if (now - lastSave < 500) return
        lastSave = now
        setReadingProgress(progressKey, window.scrollY)
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
      // Final save on unmount
      setReadingProgress(progressKey, window.scrollY)
    }
  }, [progressKey, setReadingProgress])

  return (
    <div className={cn('reader-theme-root min-h-screen transition-colors duration-200', `reader-${theme}`)}>
      <div
        className="mx-auto px-4 sm:px-6 py-8"
        style={{ maxWidth: settings.max_width }}
      >
        {chapterTitle && (
          <h2
            className="reader-chapter-title font-semibold text-center mb-10"
            style={{ fontSize: settings.font_size * 1.2 }}
          >
            {chapterTitle}
          </h2>
        )}
        <div
          ref={contentRef}
          data-reader-font
          className={cn(
            // Paragraph styles matching ficbook.net
            '[&_p]:mb-0 [&_p]:mt-0',
            '[&_p]:text-indent-[1.5em]',
            // Dialogue lines (em dash) — no indent
            '[&_p:has(>em)]:text-indent-0',
            '[&_em]:not-italic',
            '[&_i]:italic',
            '[&_b]:font-bold',
            '[&_strong]:font-bold',
            '[&_img]:mx-auto [&_img]:block [&_img]:rounded [&_img]:my-4',
          )}
          style={{
            // CSS var so globals.css can force it into every descendant with !important,
            // beating any inline `style="font-family:..."` ficbook injects into paragraphs.
            ['--reader-font-family' as string]: getFontCssVar(settings.font_family),
            fontFamily: getFontCssVar(settings.font_family),
            fontSize: settings.font_size,
            lineHeight: settings.line_height,
          }}
        >
          {/* Inject paragraph styles and theme colors that Tailwind arbitrary variants can't cover */}
          <style>{`
            .reader-theme-root.reader-light { background-color: #ffffff; color: #18181b; }
            .reader-theme-root.reader-light .reader-chapter-title { color: #71717a; }
            .reader-theme-root.reader-light .reader-content p { color: #27272a; }
            .reader-theme-root.reader-light .reader-content a { color: #7c3aed; }
            .reader-theme-root.reader-light .reader-content hr { border-color: #d4d4d8; }
            .reader-theme-root.reader-light .reader-content blockquote { border-left: 2px solid #a1a1aa; color: #52525b; }

            .reader-theme-root.reader-dark { background-color: #1a1a1a; color: #d4d4d8; }
            .reader-theme-root.reader-dark .reader-chapter-title { color: #71717a; }
            .reader-theme-root.reader-dark .reader-content p { color: #d4d4d8; }
            .reader-theme-root.reader-dark .reader-content a { color: #c4b5fd; }
            .reader-theme-root.reader-dark .reader-content hr { border-color: #3f3f46; }
            .reader-theme-root.reader-dark .reader-content blockquote { border-left: 2px solid #52525b; color: #a1a1aa; }

            .reader-theme-root.reader-amoled { background-color: #000000; color: #e4e4e7; }
            .reader-theme-root.reader-amoled .reader-chapter-title { color: #71717a; }
            .reader-theme-root.reader-amoled .reader-content p { color: #e4e4e7; }
            .reader-theme-root.reader-amoled .reader-content a { color: #c4b5fd; }
            .reader-theme-root.reader-amoled .reader-content hr { border-color: #27272a; }
            .reader-theme-root.reader-amoled .reader-content blockquote { border-left: 2px solid #3f3f46; color: #a1a1aa; }

            .reader-theme-root.reader-sepia { background-color: #f4ecd8; color: #5b4636; }
            .reader-theme-root.reader-sepia .reader-chapter-title { color: #8a7358; }
            .reader-theme-root.reader-sepia .reader-content p { color: #5b4636; }
            .reader-theme-root.reader-sepia .reader-content a { color: #7a4b1e; }
            .reader-theme-root.reader-sepia .reader-content hr { border-color: #d8ceb5; }
            .reader-theme-root.reader-sepia .reader-content blockquote { border-left: 2px solid #b8a586; color: #7a6a55; }

            .reader-theme-root.reader-paper { background-color: #faf7f2; color: #2a2a2a; }
            .reader-theme-root.reader-paper .reader-chapter-title { color: #6b6b6b; }
            .reader-theme-root.reader-paper .reader-content p { color: #2a2a2a; }
            .reader-theme-root.reader-paper .reader-content a { color: #5b21b6; }
            .reader-theme-root.reader-paper .reader-content hr { border-color: #e5e2dc; }
            .reader-theme-root.reader-paper .reader-content blockquote { border-left: 2px solid #c4c1bb; color: #5c5c5c; }

            .reader-content p {
              margin: 0;
              text-indent: 1.5em;
            }
            .reader-content p:empty { display: none; }
            .reader-content p + p { margin-top: 0; }
            .reader-content a:hover { text-decoration: underline; }
            .reader-content hr { margin: 1.5rem 0; }
            .reader-content blockquote { padding-left: 1rem; font-style: italic; }
          `}</style>
          <div
            className={`reader-content reader-${theme}`}
            dangerouslySetInnerHTML={{ __html: processedContent }}
          />
        </div>
      </div>
    </div>
  )
}
