'use client'
import { useEffect, useRef } from 'react'
import { useReaderStore } from '@/store'
import { cn } from '@/lib/utils'

interface ReaderContentProps {
  content: string
  chapterTitle?: string
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
  const proseClass = settings.theme === 'light' ? 'prose-zinc' : 'prose-invert'

  // Fix image URLs in content — make relative paths absolute
  const fixedContent = content
    .replace(/src="///g, 'src="https://')
    .replace(/src="//g, 'src="https://ficbook.net/')

  return (
    <div className={cn('min-h-screen transition-colors duration-200', bgClass, textClass)}>
      <div
        className="mx-auto px-4 sm:px-6 py-8"
        style={{ maxWidth: settings.max_width }}
      >
        {chapterTitle && (
          <h2
            className="font-semibold text-center mb-10 opacity-60"
            style={{ fontSize: settings.font_size * 1.2 }}
          >
            {chapterTitle}
          </h2>
        )}
        <div
          ref={contentRef}
          className={cn(
            'prose max-w-none',
            proseClass,
            settings.font_family === 'serif' ? 'font-reading' : 'font-sans',
            // Override prose defaults for better readability
            '[&_p]:mb-4 [&_p]:leading-relaxed',
            '[&_img]:mx-auto [&_img]:rounded',
            '[&_a]:text-purple-400 [&_a]:no-underline [&_a:hover]:underline',
            settings.theme !== 'light' && '[&_p]:text-zinc-200',
          )}
          style={{
            fontSize: settings.font_size,
            lineHeight: settings.line_height,
          }}
          dangerouslySetInnerHTML={{ __html: fixedContent }}
        />
      </div>
    </div>
  )
}
