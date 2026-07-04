'use client'
import { useEffect } from 'react'
import { useAuthStore, useReaderStore } from '@/store'
import { readingStateApi, profileApi } from '@/lib/api'

/**
 * Silent hydrator — runs on every accessToken change (login / page load).
 * 1. Pulls anchors + history + bookmarks from the backend.
 * 2. Refreshes the auth store user with the latest ficbook avatar from
 *    /profile/me so the header always shows the current avatar even when
 *    the user logged in before avatar extraction was implemented.
 */
export function ReadingStateHydrator() {
  const accessToken = useAuthStore(s => s.accessToken)
  const user = useAuthStore(s => s.user)
  const setAuth = useAuthStore(s => s.setAuth)
  const hydrateAnchors = useReaderStore(s => s.hydrateAnchorsFromServer)
  const hydrateHistory = useReaderStore(s => s.hydrateHistoryFromServer)
  const hydrateBookmarks = useReaderStore(s => s.hydrateBookmarksFromServer)

  useEffect(() => {
    if (!accessToken) return
    let alive = true

    ;(async () => {
      try {
        const [anchors, history, bookmarks, profileRes] = await Promise.all([
          readingStateApi.listAnchors(),
          readingStateApi.listHistory(200),
          readingStateApi.listBookmarks(500),
          profileApi.me().catch(() => null),
        ])
        if (!alive) return

        // Update avatar in auth store if the server has a newer one
        if (profileRes && accessToken) {
          const p = profileRes.data
          const serverAvatar = p.avatar_url || p.ficbook_avatar_url || null
          if (serverAvatar && user?.ficbook_avatar_url !== serverAvatar) {
            setAuth(
              { ...user!, ficbook_avatar_url: serverAvatar, ficbook_username: p.ficbook_username || user?.ficbook_username },
              accessToken,
            )
          }
        }

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
        // Silent
      }
    })()

    return () => { alive = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken])

  return null
}
