'use client'
import { useMemo } from 'react'
import styles from './loaders.module.css'

// Registry of available loader class names in loaders.module.css.
// To add a new loader: add its CSS block to loaders.module.css and its class name here.
const LOADERS = [
  'hourglass', 'planet', 'orbit', 'disc', 'pearl',
  'pong', 'tulip', 'bouncer', 'eyes', 'balance',
  'magnifier', 'pendulum', 'drop', 'book', 'face',
  'pan', 'bars',
] as const
type LoaderName = typeof LOADERS[number]

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
    return LOADERS[Math.floor(Math.random() * LOADERS.length)]
  }, [variant])

  return (
    <div className={`flex flex-col items-center justify-center gap-4 py-16 ${className ?? ''}`}>
      <div className={styles[name]} aria-label={label ?? 'Загрузка'} role="status" />
      {label && (
        <p className="text-sm text-zinc-500 text-center">{label}</p>
      )}
    </div>
  )
}
