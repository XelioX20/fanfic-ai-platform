'use client'
import { useEffect } from 'react'
import Link from 'next/link'

export default function FanficError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[/fanfic/[id]] client error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-zinc-900 border border-red-900/50 rounded-xl p-6 space-y-3">
        <h1 className="text-lg font-semibold text-red-300">Не удалось открыть фанфик</h1>
        <p className="text-sm text-zinc-300 whitespace-pre-wrap break-words font-mono">
          {error.message || 'Неизвестная ошибка'}
        </p>
        {error.digest && (
          <p className="text-[10px] text-zinc-600">Digest: {error.digest}</p>
        )}
        {error.stack && (
          <details className="text-xs text-zinc-500">
            <summary className="cursor-pointer hover:text-zinc-300">Stack trace</summary>
            <pre className="mt-2 text-[10px] whitespace-pre-wrap break-words">{error.stack}</pre>
          </details>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Попробовать снова
          </button>
          <Link
            href="/"
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-sm font-medium transition-colors"
          >
            На главную
          </Link>
        </div>
      </div>
    </div>
  )
}
