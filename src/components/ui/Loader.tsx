'use client'
import { useMemo } from 'react'
import styles from './loaders.module.css'
import { useUIStore } from '@/store'
import { useLoaderPrefs, isLoaderEnabled } from '@/store/loaderPrefs'
import { CauldronLoader } from './loaders/CauldronLoader'
import { Book3dLoader } from './loaders/Book3dLoader'
import { CatLoader } from './loaders/CatLoader'
import { HandLoader } from './loaders/HandLoader'
import { HamsterLoader } from './loaders/HamsterLoader'
import { BeesLoader } from './loaders/BeesLoader'
import { ButterflyLoader } from './loaders/ButterflyLoader'
import { SharinganLoader } from './loaders/SharinganLoader'
import { SketchLoader } from './loaders/SketchLoader'
import { DogLoader } from './loaders/DogLoader'
import { CampsiteLoader } from './loaders/CampsiteLoader'
import { EvaLoader } from './loaders/EvaLoader'

type Theme = 'light' | 'dark' | 'amoled'
const ALL_THEMES: Theme[] = ['light', 'dark', 'amoled']

// Each loader entry: name, optional themes allow-list (default = all themes).
// Set `themes` when the loader looks bad in some themes (e.g. cat is ink-on-white).
export type LoaderEntry =
  | { kind: 'simple'; name: string; themes?: Theme[] }
  | { kind: 'complex'; name: string; Component: React.ComponentType; themes?: Theme[] }

export const REGISTRY: LoaderEntry[] = [
  // Simple (CSS in loaders.module.css)
  { kind: 'simple', name: 'hourglass' },
  { kind: 'simple', name: 'eyes' },
  { kind: 'simple', name: 'book' },
  { kind: 'simple', name: 'face' },
  { kind: 'simple', name: 'pan' },
  { kind: 'simple', name: 'gear' },
  { kind: 'simple', name: 'stickball' },
  { kind: 'simple', name: 'treadmill' },
  { kind: 'simple', name: 'eightbit' },
  { kind: 'simple', name: 'elevator' },
  { kind: 'simple', name: 'rings' },
  { kind: 'simple', name: 'pawprints' },
  { kind: 'simple', name: 'duck' },

  // Complex (multi-element JSX)
  { kind: 'complex', name: 'cauldron', Component: CauldronLoader },
  { kind: 'complex', name: 'book3d',   Component: Book3dLoader },
  { kind: 'complex', name: 'hand',     Component: HandLoader },
  { kind: 'complex', name: 'hamster',  Component: HamsterLoader },
  { kind: 'complex', name: 'bees',     Component: BeesLoader },
  { kind: 'complex', name: 'butterfly',Component: ButterflyLoader },
  // Light-theme-only: ink-on-white, illegible on dark backgrounds.
  { kind: 'complex', name: 'cat',      Component: CatLoader, themes: ['light'] },
  { kind: 'complex', name: 'sharingan', Component: SharinganLoader },
  { kind: 'complex', name: 'sketch', Component: SketchLoader, themes: ['light'] },
  { kind: 'complex', name: 'dog', Component: DogLoader },
  { kind: 'complex', name: 'campsite', Component: CampsiteLoader, themes: ['dark', 'amoled'] },
  { kind: 'complex', name: 'eva', Component: EvaLoader, themes: ['dark', 'amoled'] },
]

function isAllowed(entry: LoaderEntry, theme: Theme) {
  return !entry.themes || entry.themes.includes(theme)
}

export function pickLoadersForTheme(theme: Theme): LoaderEntry[] {
  return REGISTRY.filter(e => isAllowed(e, theme))
}

interface LoaderProps {
  /** Optional caption shown below the loader */
  label?: string
  /** Pin to a specific loader for testing/deterministic use */
  variant?: string
  /** Extra className on the outer wrapper */
  className?: string
}

/**
 * Big screen-filling loader used while a page fetches its initial data.
 * Picks a random loader from the registry each mount, filtered by current site theme.
 */
export function Loader({ label, variant, className }: LoaderProps) {
  const theme = useUIStore(s => (ALL_THEMES.includes(s.theme as Theme) ? (s.theme as Theme) : 'dark'))
  const modes = useLoaderPrefs(s => s.modes)

  const entry = useMemo<LoaderEntry>(() => {
    if (variant) {
      const found = REGISTRY.find(e => e.name === variant)
      if (found) return found
    }
    const pool = REGISTRY.filter(e => isLoaderEnabled(e.name, theme, e.themes, modes[e.name]))
    // Fallback: if user disabled EVERYTHING, still pick something (hourglass) so page doesn't crash
    if (pool.length === 0) return REGISTRY[0]
    return pool[Math.floor(Math.random() * pool.length)]
    // theme is intentionally part of deps — flipping theme should re-pick a suitable loader
  }, [variant, theme, modes])

  return (
    <div className={`flex flex-col items-center justify-center gap-4 py-16 ${className ?? ''}`}>
      {entry.kind === 'complex'
        ? <entry.Component />
        : <div className={styles[entry.name]} aria-label={label ?? 'Загрузка'} role="status" />
      }
      {label && (
        <p className="text-sm text-zinc-500 text-center">{label}</p>
      )}
    </div>
  )
}
