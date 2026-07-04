'use client'
import { useEffect } from 'react'
import { useAuthStore, useReaderStore } from '@/store'
import { readingStateApi } from '@/lib/api'

/**
 * Silent hydrator — pulls anchors + local history from the backend right
 * after a JWT becomes available (login / page load with existing session).
 * Merges server rows on top of whatever's already in the local persisted
 * store, so a phone that hasn't seen a fic yet still gets the anchor the
 * user placed on their laptop.
 *
 * Rendered once, near the root of the client tree (see providers.tsx).
 * Fire-and-forget: failures are silent — we still function offline.
 */
export function ReadingStateHydrator() {
  const accessToken = useAuthStore(s => s.accessToken)
  const hydrateAnchors = useReaderStore(s => s.hydrateAnchorsFromServer)
  const hydrateHistory = useReaderStore(s => s.hydrateHistoryFromServer)
  const hydrateBookmarks = useReaderStore(s => s.hydrateBookmarksFromServer)

  useEffect(() => {
    if (!accessToken) return
    let alive = true

    ;(async () => {
      try {
        const [anchors, history, bookmarks] = await Promise.all([
          readingStateApi.listAnchors(),
          readingStateApi.listHistory(200),
          readingStateApi.listBookmarks(500),
        ])
        if (!alive) return
        hydrateAnchors(
          anchors.data.map(r => ({
            fanficId: r.fanfic_id,
            chapterId: r.chapter_id,
            scrollY: r.scroll_y,
            chapterTitle: r.chapter_title ?? undefined,
            updatedAt: new Date(r.updated_at).getTime(),
          })),
        )
        hydrateHistory(
          history.data.map(r => ({
            fanficId: r.fanfic_id,
            title: r.title,
            author_name: r.author_name || '',
            author_id: r.author_id ?? undefined,
            cover_url: r.cover_url ?? null,
            direction: r.direction ?? undefined,
            rating: r.rating ?? undefined,
            completion_status: r.completion_status ?? undefined,
            fandoms: r.fandoms ?? [],
            openedAt: new Date(r.opened_at).getTime(),
          })),
        )
        hydrateBookmarks(
          bookmarks.data.map(r => ({
            fanficId: r.fanfic_id,
            title: r.title,
            author_name: r.author_name || '',
            author_id: r.author_id ?? undefined,
            cover_url: r.cover_url ?? null,
            direction: r.direction ?? undefined,
            rating: r.rating ?? undefined,
            completion_status: r.completion_status ?? undefined,
            fandoms: r.fandoms ?? [],
            addedAt: new Date(r.added_at).getTime(),
          })),
        )
      } catch {
        // Silent — backend may be waking up on Render free-tier, or the
        // user's JWT might be stale (interceptor in api.ts handles 401).
      }
    })()

    return () => {
      alive = false
    }
  }, [accessToken, hydrateAnchors, hydrateHistory, hydrateBookmarks])

  return null
}
