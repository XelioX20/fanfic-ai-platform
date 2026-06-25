'use client'
import { useRef } from 'react'
import { useReaderStore } from '@/store'
import { cn } from '@/lib/utils'

interface ReaderContentProps {
  content: string
  chapterTitle?: string
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

export function ReaderContent({ content, chapterTitle }: ReaderContentProps) {
  const { settings } = useReaderStore()
  const contentRef = useRef<HTMLDivElement>(null)

  const bgClass = settings.theme === 'amoled'
    ? 'bg-black'
    : settings.theme === 'dark'
    ? 'bg-zinc-950'
    : 'bg-amber-50'

  const textClass = settings.theme === 'light' ? 'text-zinc-900' : 'text-zinc-100'

  const processedContent = formatChapterHtml(content)

  return (
    <div className={cn('min-h-screen transition-colors duration-200', bgClass, textClass)}>
      <div
        className="mx-auto px-4 sm:px-6 py-8"
        style={{ maxWidth: settings.max_width }}
      >
        {chapterTitle && (
          <h2
            className={cn('font-semibold text-center mb-10', settings.theme === 'light' ? 'text-zinc-500' : 'text-zinc-500')}
            style={{ fontSize: settings.font_size * 1.2 }}
          >
            {chapterTitle}
          </h2>
        )}
        <div
          ref={contentRef}
          className={cn(
            settings.font_family === 'serif' ? 'font-reading' : 'font-sans',
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
            '[&_a]:text-purple-400 [&_a:hover]:underline',
            '[&_hr]:border-zinc-700 [&_hr]:my-6',
            '[&_blockquote]:border-l-2 [&_blockquote]:border-zinc-600 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-zinc-400',
            settings.theme !== 'light' ? '[&_p]:text-zinc-200' : '[&_p]:text-zinc-800',
          )}
          style={{
            fontSize: settings.font_size,
            lineHeight: settings.line_height,
          }}
        >
          {/* Inject paragraph styles that Tailwind arbitrary variants can't cover */}
          <style>{`
            .reader-content p {
              margin: 0;
              text-indent: 1.5em;
            }
            .reader-content p:empty { display: none; }
            .reader-content p + p { margin-top: 0; }
          `}</style>
          <div
            className="reader-content"
            dangerouslySetInnerHTML={{ __html: processedContent }}
          />
        </div>
      </div>
    </div>
  )
}
