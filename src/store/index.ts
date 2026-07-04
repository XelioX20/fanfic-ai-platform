import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Theme, ReaderSettings } from '@/types'

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
  anchors: Record<string, ReadingAnchor>
  setAnchor: (anchor: ReadingAnchor) => void
  clearAnchor: (fanficId: string) => void
  // Local history — every fanfic detail page open updates this.
  history: Record<string, HistoryEntry>
  recordHistory: (entry: Omit<HistoryEntry, 'openedAt'>) => void
  clearHistoryEntry: (fanficId: string) => void
  clearAllHistory: () => void
}

export const useReaderStore = create<ReaderState>()(
  persist(
    (set) => ({
      settings: {
        font_size: 16,
        font_family: 'system-serif',
        line_height: 1.8,
        max_width: 680,
        theme: 'dark' as Theme,
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
      setAnchor: (anchor) =>
        set((state) => ({
          anchors: { ...(state.anchors ?? {}), [anchor.fanficId]: { ...anchor, updatedAt: Date.now() } },
        })),
      clearAnchor: (fanficId) =>
        set((state) => {
          const next = { ...(state.anchors ?? {}) }
          delete next[fanficId]
          return { anchors: next }
        }),
      history: {},
      recordHistory: (entry) =>
        set((state) => ({
          history: { ...(state.history ?? {}), [entry.fanficId]: { ...entry, openedAt: Date.now() } },
        })),
      clearHistoryEntry: (fanficId) =>
        set((state) => {
          const next = { ...(state.history ?? {}) }
          delete next[fanficId]
          return { history: next }
        }),
      clearAllHistory: () => set({ history: {} }),
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
          settings: persisted.settings ?? currentState.settings,
          currentFanficId: persisted.currentFanficId ?? currentState.currentFanficId,
          readingProgress: persisted.readingProgress ?? {},
          anchors: persisted.anchors ?? {},
          history: persisted.history ?? {},
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
        document.documentElement.className = theme
      },
    }),
    { name: 'ui-store' }
  )
)
