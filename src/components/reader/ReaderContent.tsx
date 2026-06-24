'use client'
import { useReaderStore } from '@/store'
import { cn } from '@/lib/utils'

interface ReaderContentProps {
  content: string
  chapterTitle?: string
}

export function ReaderContent({ content, chapterTitle }: ReaderContentProps) {
  const { settings } = useReaderStore()
  const bgClass = settings.theme === 'amoled' ? 'bg-black' : settings.theme === 'dark' ? 'bg-zinc-950' : 'bg-white'
  const textClass = settings.theme === 'light' ? 'text-zinc-900' : 'text-zinc-100'

  return (
    <div className={cn('min-h-screen transition-colors', bgClass, textClass)}>
      <div
        className="mx-auto px-4 py-8"
        style={{ maxWidth: settings.max_width }}
      >
        {chapterTitle && (
          <h2 className="text-xl font-semibold mb-8 text-center opacity-70">
            {chapterTitle}
          </h2>
        )}
        <div
          className={cn(
            'prose prose-zinc max-w-none',
            settings.theme !== 'light' && 'prose-invert',
            settings.font_family === 'serif' ? 'font-reading' : 'font-sans',
          )}
          style={{
            fontSize: settings.font_size,
            lineHeight: settings.line_height,
          }}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    </div>
  )
}
