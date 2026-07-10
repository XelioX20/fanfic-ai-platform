import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Per-loader admin mode.
 *   'off'    — disabled everywhere
 *   'all'    — enabled for every site theme
 *   'light'  — only when site theme is light
 *   'dark'   — only in dark themes (dark OR amoled)
 * Anything not present in the map defaults to 'all'.
 */
export type LoaderMode = 'off' | 'all' | 'light' | 'dark'

interface LoaderPrefsState {
  modes: Record<string, LoaderMode>
  setMode: (name: string, mode: LoaderMode) => void
  reset: () => void
}

// Legacy migration: previous versions stored 'amoled' as a separate mode. Fold it into 'dark'.
function normalizeMode(v: unknown): LoaderMode {
  if (v === 'off' || v === 'all' || v === 'light' || v === 'dark') return v
  if (v === 'amoled') return 'dark'
  return 'all'
}

export const useLoaderPrefs = create<LoaderPrefsState>()(
  persist(
    (set) => ({
      modes: {},
      setMode: (name, mode) => set(s => ({ modes: { ...s.modes, [name]: mode } })),
      reset: () => set({ modes: {} }),
    }),
    {
      name: 'loader-prefs',
      migrate: (persisted): LoaderPrefsState => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const s = (persisted as any) ?? {}
        const raw = (s.modes ?? {}) as Record<string, unknown>
        const modes: Record<string, LoaderMode> = {}
        for (const [k, v] of Object.entries(raw)) modes[k] = normalizeMode(v)
        return { ...s, modes } as LoaderPrefsState
      },
      version: 2,
    }
  )
)

/**
 * Decide if a loader is enabled for a given site theme, honoring both
 * the loader's built-in `themes` allow-list AND the user's admin mode.
 * Built-in restrictions are still expressed in raw theme names (light/dark/amoled)
 * so we handle the collapse at check time: user's 'dark' matches site 'dark' or 'amoled'.
 */
export function isLoaderEnabled(
  name: string,
  siteTheme: 'light' | 'dark' | 'amoled' | 'fable',
  builtInThemes: ('light' | 'dark' | 'amoled' | 'fable')[] | undefined,
  mode: LoaderMode | undefined,
): boolean {
  // Built-in restriction wins
  if (builtInThemes && !builtInThemes.includes(siteTheme)) return false
  const m = mode ?? 'all'
  if (m === 'off') return false
  if (m === 'all') return true
  // Fable is a light-family (cream) theme for loader purposes.
  if (m === 'light') return siteTheme === 'light' || siteTheme === 'fable'
  // 'dark' covers both dark + amoled
  return siteTheme === 'dark' || siteTheme === 'amoled'
}
