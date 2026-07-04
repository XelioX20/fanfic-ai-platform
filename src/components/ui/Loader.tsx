'use client'
import { useMemo } from 'react'
import styles from './loaders.module.css'
import { CauldronLoader } from './loaders/CauldronLoader'

// Two kinds of loaders:
// 1. Simple: single-element CSS in loaders.module.css — added by name in SIMPLE_LOADERS
// 2. Complex: multi-element JSX components — added to COMPLEX_LOADERS
const SIMPLE_LOADERS = [
  'hourglass', 'eyes', 'book', 'face', 'pan',
  'gear', 'stickball', 'treadmill', 'eightbit', 'elevator',
  'rings', 'pawprints', 'duck',
] as const

const COMPLEX_LOADERS = ['cauldron'] as const

type SimpleName = typeof SIMPLE_LOADERS[number]
type ComplexName = typeof COMPLEX_LOADERS[number]
type LoaderName = SimpleName | ComplexName

const ALL_LOADERS: LoaderName[] = [...SIMPLE_LOADERS, ...COMPLEX_LOADERS]

const COMPLEX_COMPONENTS: Record<ComplexName, React.ComponentType> = {
  cauldron: CauldronLoader,
}

interface LoaderProps {
  /** Optional caption shown below the loader */
  label?: string
  /** Pin to a specific loader for testing/deterministic use */
  variant?: LoaderName
  /** Extra className on the outer wrapper */
  className?: string
}

/**
 * Big screen-filling loader used while a page fetches its initial data.
 * Picks a random loader from the registry each mount unless `variant` is set.
 */
export function Loader({ label, variant, className }: LoaderProps) {
  const name = useMemo<LoaderName>(() => {
    if (variant) return variant
    return ALL_LOADERS[Math.floor(Math.random() * ALL_LOADERS.length)]
  }, [variant])

  const isComplex = (COMPLEX_LOADERS as readonly string[]).includes(name)
  const ComplexComp = isComplex ? COMPLEX_COMPONENTS[name as ComplexName] : null

  return (
    <div className={`flex flex-col items-center justify-center gap-4 py-16 ${className ?? ''}`}>
      {ComplexComp
        ? <ComplexComp />
        : <div className={styles[name as SimpleName]} aria-label={label ?? 'Загрузка'} role="status" />
      }
      {label && (
        <p className="text-sm text-zinc-500 text-center">{label}</p>
      )}
    </div>
  )
}
