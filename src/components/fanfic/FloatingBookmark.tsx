'use client'
import { useState } from 'react'
import { Bookmark, Check } from 'lucide-react'
import { useAuthStore, useReaderStore } from '@/store'
import { cn } from '@/lib/utils'

interface Props {
  fanficId: string
  // Optional card metadata — when supplied we cache it in the bookmark row so
  // /profile → Избранное can render the fic without re-fetching from ficbook.
  meta?: {
    title?: string
    author_name?: string
    author_id?: string
    cover_url?: string | null
    direction?: string
    rating?: string
    completion_status?: string
    fandoms?: string[]
  }
}

/**
 * Floating "add to favourites" button — bottom-right of the fanfic detail page.
 *
 * Writes to the local bookmarks store (useReaderStore.bookmarks). The store
 * fire-and-forget syncs to /api/v1/profile/bookmarks so the bookmark shows
 * up on every device signed into the same account, and under /profile →
 * Избранное.
 *
 * Distinct from the heart button in the action bar (which also toggles the
 * same local bookmark, plus mirrors to ficbook via /actions/like when the
 * user has linked ficbook). This FAB is the simpler, always-works path —
 * no ficbook link required.
 */
export function FloatingBookmark({ fanficId, meta }: Props) {
  const { accessToken } = useAuthStore()
  const isBookmarked = useReaderStore(s => !!(s.bookmarks ?? {})[fanficId])
  const setBookmark = useReaderStore(s => s.setBookmark)
  const removeBookmark = useReaderStore(s => s.removeBookmark)
  const [flashSaved, setFlashSaved] = useState(false)

  if (!accessToken) return null

  const toggle = () => {
    if (isBookmarked) {
      removeBookmark(fanficId)
      return
    }
    setBookmark({
      fanficId,
      title: meta?.title ?? '',
      author_name: meta?.author_name ?? '',
      author_id: meta?.author_id,
      cover_url: meta?.cover_url ?? null,
      direction: meta?.direction,
      rating: meta?.rating,
      completion_status: meta?.completion_status,
      fandoms: meta?.fandoms,
    })
    setFlashSaved(true)
    window.setTimeout(() => setFlashSaved(false), 1400)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={isBookmarked ? 'Убрать из избранного' : 'Добавить в избранное'}
      className={cn(
        'fixed bottom-24 right-4 sm:right-6 z-40 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all',
        flashSaved
          ? 'bg-emerald-600 text-white shadow-emerald-900/40 scale-110'
          : isBookmarked
            ? 'bg-pink-600 text-white hover:bg-pink-500 shadow-pink-900/40 ring-2 ring-pink-300/50'
            : 'bg-zinc-900 text-zinc-100 border border-zinc-700 hover:border-pink-500 hover:text-pink-300',
      )}
    >
      {flashSaved
        ? <Check size={18} />
        : <Bookmark size={18} className={isBookmarked ? 'fill-current' : ''} />
      }
    </button>
  )
}
