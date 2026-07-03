import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Theme, ReaderSettings } from '@/types'

interface AuthState {
  user: User | null
  accessToken: string | null
  setAuth: (user: User, token: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      setAuth: (user, accessToken) => {
        set({ user, accessToken })
        localStorage.setItem('access_token', accessToken)
      },
      clearAuth: () => {
        set({ user: null, accessToken: null })
        localStorage.removeItem('access_token')
      },
    }),
    { name: 'auth-store' }
  )
)

interface ReaderState {
  settings: ReaderSettings
  updateSettings: (partial: Partial<ReaderSettings>) => void
  currentFanficId: string | null
  setCurrentFanfic: (id: string) => void
  readingProgress: Record<string, number>
  setReadingProgress: (fanficId: string, progress: number) => void
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
      setReadingProgress: (fanficId, progress) =>
        set((state) => ({
          readingProgress: { ...state.readingProgress, [fanficId]: progress },
        })),
    }),
    { name: 'reader-store' }
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
