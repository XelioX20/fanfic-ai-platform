import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Theme, ReaderTheme, ReaderSettings } from '@/types'

interface AuthState {
  user: User | null
  accessToken: string | null
  setAuth: (user: User, token: string) => void
  clearAuth: () => void
}

// Auth is persisted in localStorage by default. The login page can opt out of
// persistence via `rememberMe=false` by clearing the store keys immediately
// after login; partialize keeps localStorage clean of secondary duplicates.
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      setAuth: (user, accessToken) => {
        set({ user, accessToken })
        // Legacy consumers (older code paths / debug tools) read this key.
        // The persist middleware itself also serializes accessToken into
        // 'auth-store' — logout must clear both, see clearAuth below.
        localStorage.setItem('access_token', accessToken)
      },
      clearAuth: () => {
        set({ user: null, accessToken: null })
        localStorage.removeItem('access_token')
        // Wipe the persisted store entirely so remember-me=off truly forgets.
        try { localStorage.removeItem('auth-store') } catch { /* SSR */ }
      },
    }),
    { name: 'auth-store' }
  )
)

/** Reading-progress value shape. Legacy entries persist as a plain scrollY number. */
export type ReadingProgressValue = number | { scrollY: number; updatedAt: number }

/**
 * A user-placed anchor — one per fanfic. Set explicitly by pressing the
 * ⚓ button in the reader. Distinct from `readingProgress` which auto-tracks
 * every scroll. Anchors are what the fanfic detail page's "Продолжить с
 * последнего места" button uses.
 */
export interface ReadingAnchor {
  fanficId: string
  chapterId: string        // 'single' for single-chapter fics
  scrollY: number
  chapterTitle?: string    // for UX display only
  updatedAt: number
}

/**
 * Local-only history record. Written every time a user opens a fanfic detail
 * page, so the /profile → История tab can show everything they've ever looked
 * at (including anonymous browsing) without a round-trip to ficbook. Keyed by
 * fanficId; visiting the same fic again just updates openedAt.
 */
export interface HistoryEntry {
  fanficId: string
  title: string
  author_name: string
  author_id?: string
  cover_url?: string | null
  direction?: string
  rating?: string
  completion_status?: string
  fandoms?: string[]
  openedAt: number
}

/**
 * "В избранное" toggle target. Written by the heart / bookmark buttons on
 * the fanfic detail page, mirrors cross-device via the /profile/bookmarks
 * backend endpoints. This is OUR notion of favourites — independent of
 * whether the user has linked a ficbook account.
 */
export interface BookmarkEntry {
  fanficId: string
  title: string
  author_name: string
  author_id?: string
  cover_url?: string | null
  direction?: string
  rating?: string
  completion_status?: string
  fandoms?: string[]
  addedAt: number
}

interface ReaderState {
  settings: ReaderSettings
  updateSettings: (partial: Partial<ReaderSettings>) => void
  currentFanficId: string | null
  setCurrentFanfic: (id: string) => void
  // Key format: `${fanficId}:${chapterId}` (or just fanficId for single-chapter fics).
  // See extractRecentProgress in app/page.tsx — consumers must tolerate both value shapes.
  readingProgress: Record<string, ReadingProgressValue>
  setReadingProgress: (key: string, scrollY: number) => void
  // One anchor per fanfic. Keyed by fanficId so setting a new anchor
  // in chapter 5 overwrites an anchor from chapter 2 of the same fic.
  //
  // Cross-device sync: setAnchor / clearAnchor also PUT/DELETE to
  // /api/v1/profile/anchors on the backend if there's a JWT. Failures are
  // swallowed — local state remains the source of truth for the current
  // session. See providers.tsx for the initial pull on login.
  anchors: Record<string, ReadingAnchor>
  setAnchor: (anchor: ReadingAnchor) => void
  clearAnchor: (fanficId: string) => void
  // Local history — every fanfic detail page open updates this.
  // Same cross-device sync policy as anchors.
  history: Record<string, HistoryEntry>
  recordHistory: (entry: Omit<HistoryEntry, 'openedAt'>) => void
  clearHistoryEntry: (fanficId: string) => void
  clearAllHistory: () => void
  // Local bookmarks — the ⭐/♥ 'в избранное' state. Same sync policy.
  bookmarks: Record<string, BookmarkEntry>
  setBookmark: (entry: Omit<BookmarkEntry, 'addedAt'>) => void
  removeBookmark: (fanficId: string) => void
  // Bulk import from server after login. Merges the server snapshot into the
  // local map: server rows override same-key local rows.
  hydrateAnchorsFromServer: (rows: ReadingAnchor[]) => void
  hydrateHistoryFromServer: (rows: HistoryEntry[]) => void
  hydrateBookmarksFromServer: (rows: BookmarkEntry[]) => void
}

/* ─── Sync helpers ────────────────────────────────────────────────────
 *
 * Fire-and-forget best-effort sync of anchors/history to the backend.
 * Import from lib/api at call time (not top level) to avoid circular deps.
 * If there's no JWT or the request fails, we swallow — local state stays
 * the source of truth for this session.
 */
async function syncPutAnchor(fanficId: string, anchor: ReadingAnchor) {
  if (typeof window === 'undefined') return
  if (!localStorage.getItem('access_token')) return
  try {
    const { readingStateApi } = await import('@/lib/api')
    await readingStateApi.upsertAnchor(fanficId, {
      chapter_id: anchor.chapterId,
      scroll_y: Math.round(anchor.scrollY),
      chapter_title: anchor.chapterTitle ?? null,
    })
  } catch { /* offline / not authed / server down — ignore */ }
}

async function syncDeleteAnchor(fanficId: string) {
  if (typeof window === 'undefined') return
  if (!localStorage.getItem('access_token')) return
  try {
    const { readingStateApi } = await import('@/lib/api')
    await readingStateApi.deleteAnchor(fanficId)
  } catch { /* ignore */ }
}

async function syncPutHistory(entry: HistoryEntry) {
  if (typeof window === 'undefined') return
  if (!localStorage.getItem('access_token')) return
  try {
    const { readingStateApi } = await import('@/lib/api')
    await readingStateApi.upsertHistory(entry.fanficId, {
      title: entry.title,
      author_name: entry.author_name ?? '',
      author_id: entry.author_id ?? null,
      cover_url: entry.cover_url ?? null,
      direction: entry.direction ?? null,
      rating: entry.rating ?? null,
      completion_status: entry.completion_status ?? null,
      fandoms: entry.fandoms ?? null,
    })
  } catch { /* ignore */ }
}

async function syncDeleteHistoryEntry(fanficId: string) {
  if (typeof window === 'undefined') return
  if (!localStorage.getItem('access_token')) return
  try {
    const { readingStateApi } = await import('@/lib/api')
    await readingStateApi.deleteHistoryEntry(fanficId)
  } catch { /* ignore */ }
}

async function syncClearHistory() {
  if (typeof window === 'undefined') return
  if (!localStorage.getItem('access_token')) return
  try {
    const { readingStateApi } = await import('@/lib/api')
    await readingStateApi.clearHistory()
  } catch { /* ignore */ }
}

async function syncPutBookmark(entry: BookmarkEntry) {
  if (typeof window === 'undefined') return
  if (!localStorage.getItem('access_token')) return
  try {
    const { readingStateApi } = await import('@/lib/api')
    await readingStateApi.upsertBookmark(entry.fanficId, {
      title: entry.title,
      author_name: entry.author_name ?? '',
      author_id: entry.author_id ?? null,
      cover_url: entry.cover_url ?? null,
      direction: entry.direction ?? null,
      rating: entry.rating ?? null,
      completion_status: entry.completion_status ?? null,
      fandoms: entry.fandoms ?? null,
    })
  } catch { /* ignore */ }
}

async function syncDeleteBookmark(fanficId: string) {
  if (typeof window === 'undefined') return
  if (!localStorage.getItem('access_token')) return
  try {
    const { readingStateApi } = await import('@/lib/api')
    await readingStateApi.deleteBookmark(fanficId)
  } catch { /* ignore */ }
}


export const useReaderStore = create<ReaderState>()(
  persist(
    (set) => ({
      settings: {
        font_size: 16,
        font_family: 'pt-serif',
        line_height: 1.8,
        max_width: 680,
        theme: 'dark' as ReaderTheme,
        custom_text_color: null,
        text_align: 'original',
      },
      updateSettings: (partial) =>
        set((state) => ({ settings: { ...state.settings, ...partial } })),
      currentFanficId: null,
      setCurrentFanfic: (id) => set({ currentFanficId: id }),
      readingProgress: {},
      setReadingProgress: (key, scrollY) =>
        set((state) => {
          // Rebuild the map so the touched key lands LAST — insertion order is
          // our recency fallback when updatedAt is missing on legacy entries.
          const next: Record<string, ReadingProgressValue> = {}
          for (const [k, v] of Object.entries(state.readingProgress ?? {})) {
            if (k !== key) next[k] = v
          }
          next[key] = { scrollY, updatedAt: Date.now() }
          return { readingProgress: next }
        }),
      anchors: {},
      setAnchor: (anchor) => {
        const stamped: ReadingAnchor = { ...anchor, updatedAt: Date.now() }
        set((state) => ({
          anchors: { ...(state.anchors ?? {}), [stamped.fanficId]: stamped },
        }))
        void syncPutAnchor(stamped.fanficId, stamped)
      },
      clearAnchor: (fanficId) => {
        set((state) => {
          const next = { ...(state.anchors ?? {}) }
          delete next[fanficId]
          return { anchors: next }
        })
        void syncDeleteAnchor(fanficId)
      },
      history: {},
      recordHistory: (entry) => {
        const stamped: HistoryEntry = { ...entry, openedAt: Date.now() }
        set((state) => ({
          history: { ...(state.history ?? {}), [entry.fanficId]: stamped },
        }))
        void syncPutHistory(stamped)
      },
      clearHistoryEntry: (fanficId) => {
        set((state) => {
          const next = { ...(state.history ?? {}) }
          delete next[fanficId]
          return { history: next }
        })
        void syncDeleteHistoryEntry(fanficId)
      },
      clearAllHistory: () => {
        set({ history: {} })
        void syncClearHistory()
      },
      bookmarks: {},
      setBookmark: (entry) => {
        const stamped: BookmarkEntry = { ...entry, addedAt: Date.now() }
        set((state) => ({
          bookmarks: { ...(state.bookmarks ?? {}), [entry.fanficId]: stamped },
        }))
        void syncPutBookmark(stamped)
      },
      removeBookmark: (fanficId) => {
        set((state) => {
          const next = { ...(state.bookmarks ?? {}) }
          delete next[fanficId]
          return { bookmarks: next }
        })
        void syncDeleteBookmark(fanficId)
      },
      hydrateAnchorsFromServer: (rows) => {
        set((state) => {
          const map = { ...(state.anchors ?? {}) }
          for (const r of rows) map[r.fanficId] = r
          return { anchors: map }
        })
      },
      hydrateHistoryFromServer: (rows) => {
        set((state) => {
          const map = { ...(state.history ?? {}) }
          for (const r of rows) map[r.fanficId] = r
          return { history: map }
        })
      },
      hydrateBookmarksFromServer: (rows) => {
        set((state) => {
          const map = { ...(state.bookmarks ?? {}) }
          for (const r of rows) map[r.fanficId] = r
          return { bookmarks: map }
        })
      },
    }),
    {
      name: 'reader-store',
      version: 2,
      // Legacy snapshots (v1 and earlier) didn't have `anchors` or `history`.
      // Zustand's default persist behaviour is to shallow-merge the persisted
      // snapshot on top of the initial state, so those fields end up
      // `undefined` for returning users, and every selector like
      // `s.anchors[fanficId]` throws at read time → the whole page crashes.
      //
      // Custom `merge` gives us the safe merge: we start from the initial
      // state (which HAS anchors:{} and history:{}), then layer the persisted
      // fields on top. We deliberately do NOT touch action closures — those
      // stay bound to the create() scope.
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<ReaderState>
        return {
          ...currentState,
          // Shallow-merge settings so newly-added fields (like text_align)
          // get their default value for returning users instead of being
          // undefined. Persisted values still win where they exist.
          settings: { ...currentState.settings, ...(persisted.settings ?? {}) },
          currentFanficId: persisted.currentFanficId ?? currentState.currentFanficId,
          readingProgress: persisted.readingProgress ?? {},
          anchors: persisted.anchors ?? {},
          history: persisted.history ?? {},
          bookmarks: persisted.bookmarks ?? {},
        }
      },
    }
  )
)

interface UIState {
  theme: Theme
  themeUserSet: boolean
  setTheme: (theme: Theme) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'dark',
      themeUserSet: false,
      setTheme: (theme) => {
        set({ theme, themeUserSet: true })
        // Swap only the theme token — keep next/font variable classes intact
        // (assigning className outright would wipe --font-* vars).
        if (typeof document !== 'undefined') {
          const el = document.documentElement
          el.classList.remove('light', 'dark', 'amoled', 'fable')
          el.classList.add(theme)
        }
      },
    }),
    { name: 'ui-store' }
  )
)
