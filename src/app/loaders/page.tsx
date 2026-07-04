'use client'
import { pickLoadersForTheme } from '@/components/ui/Loader'
import styles from '@/components/ui/loaders.module.css'
import { CauldronLoader } from '@/components/ui/loaders/CauldronLoader'
import { Book3dLoader } from '@/components/ui/loaders/Book3dLoader'
import { CatLoader } from '@/components/ui/loaders/CatLoader'
import { HandLoader } from '@/components/ui/loaders/HandLoader'
import { HamsterLoader } from '@/components/ui/loaders/HamsterLoader'
import { BeesLoader } from '@/components/ui/loaders/BeesLoader'
import { ButterflyLoader } from '@/components/ui/loaders/ButterflyLoader'
import { SharinganLoader } from '@/components/ui/loaders/SharinganLoader'
import { SketchLoader } from '@/components/ui/loaders/SketchLoader'
import { DogLoader } from '@/components/ui/loaders/DogLoader'
import { CampsiteLoader } from '@/components/ui/loaders/CampsiteLoader'
import { EvaLoader } from '@/components/ui/loaders/EvaLoader'

// Show ALL loaders in gallery regardless of theme so user can preview them all.
const SIMPLE: string[] = [
  'hourglass', 'eyes', 'book', 'face', 'pan',
  'gear', 'stickball', 'treadmill', 'eightbit', 'elevator',
  'rings', 'pawprints', 'duck',
]

type ComplexEntry = { name: string; Component: React.ComponentType; themes?: string[] }
const COMPLEX: ComplexEntry[] = [
  { name: 'cauldron',  Component: CauldronLoader },
  { name: 'book3d',    Component: Book3dLoader },
  { name: 'hand',      Component: HandLoader },
  { name: 'hamster',   Component: HamsterLoader },
  { name: 'bees',      Component: BeesLoader },
  { name: 'butterfly', Component: ButterflyLoader },
  { name: 'cat',       Component: CatLoader, themes: ['light'] },
  { name: 'sharingan', Component: SharinganLoader },
  { name: 'sketch',    Component: SketchLoader, themes: ['light'] },
  { name: 'dog',       Component: DogLoader },
  { name: 'campsite',  Component: CampsiteLoader, themes: ['dark', 'amoled'] },
  { name: 'eva',       Component: EvaLoader, themes: ['dark', 'amoled'] },
]

export default function LoadersPage() {
  const total = SIMPLE.length + COMPLEX.length
  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-zinc-100 mb-2">Галерея лоадеров</h1>
      <p className="text-zinc-500 text-sm mb-8">
        Всего: {total}. Лоадеры с плашкой темы показываются только в этой теме сайта.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {SIMPLE.map((name, i) => (
          <div key={name} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col items-center gap-3 hover:border-zinc-600 transition-colors">
            <div className="text-xs text-zinc-500 self-start">#{i + 1}</div>
            <div className="flex items-center justify-center min-h-[80px] w-full overflow-hidden">
              <div className={(styles as Record<string, string>)[name]} role="presentation" />
            </div>
            <p className="text-zinc-300 text-xs font-mono">{name}</p>
          </div>
        ))}
        {COMPLEX.map(({ name, Component, themes }, i) => (
          <div key={name} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col items-center gap-3 hover:border-zinc-600 transition-colors">
            <div className="flex items-center justify-between w-full">
              <div className="text-xs text-zinc-500">#{SIMPLE.length + i + 1}</div>
              {themes && themes.length < 3 && (
                <span className="text-[10px] uppercase text-amber-400 bg-amber-900/40 border border-amber-700/40 px-1.5 py-0.5 rounded">
                  {themes.join('/')}-only
                </span>
              )}
            </div>
            <div className="flex items-center justify-center min-h-[80px] w-full overflow-hidden">
              <Component />
            </div>
            <p className="text-zinc-300 text-xs font-mono">{name}</p>
          </div>
        ))}
      </div>

      <p className="text-zinc-600 text-xs mt-8 text-center">Сообщи номер или название чтобы удалить.</p>
    </main>
  )
}
