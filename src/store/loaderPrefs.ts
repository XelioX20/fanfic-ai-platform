import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Per-loader admin mode.
 *   'off'    — disabled everywhere
 *   'all'    — enabled for every site theme
 *   'light'  — only when site theme is light
 *   'dark'   — only when site theme is dark
 *   'amoled' — only when site theme is amoled
 * Anything not present in the map defaults to 'all'.
 */
export type LoaderMode = 'off' | 'all' | 'light' | 'dark' | 'amoled'

interface LoaderPrefsState {
  modes: Record<string, LoaderMode>
  setMode: (name: string, mode: LoaderMode) => void
  reset: () => void
}

export const useLoaderPrefs = create<LoaderPrefsState>()(
  persist(
    (set) => ({
      modes: {},
      setMode: (name, mode) => set(s => ({ modes: { ...s.modes, [name]: mode } })),
      reset: () => set({ modes: {} }),
    }),
    { name: 'loader-prefs' }
  )
)

/**
 * Decide if a loader is enabled for a given site theme, honoring both
 * the loader's built-in `themes` allow-list AND the user's admin mode.
 * If the mode is unset, default to 'all' (built-in allow-list still applies).
 */
export function isLoaderEnabled(
  name: string,
  siteTheme: 'light' | 'dark' | 'amoled',
  builtInThemes: ('light' | 'dark' | 'amoled')[] | undefined,
  mode: LoaderMode | undefined,
): boolean {
  // Built-in restriction wins
  if (builtInThemes && !builtInThemes.includes(siteTheme)) return false
  const m = mode ?? 'all'
  if (m === 'off') return false
  if (m === 'all') return true
  // Theme-specific mode
  return m === siteTheme
}
