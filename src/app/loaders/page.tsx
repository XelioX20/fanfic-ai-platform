'use client'
import { CauldronLoader } from '@/components/ui/loaders/CauldronLoader'
import { Book3dLoader } from '@/components/ui/loaders/Book3dLoader'
import styles from '@/components/ui/loaders.module.css'

const SIMPLE: string[] = [
  'hourglass', 'eyes', 'book', 'face', 'pan',
  'gear', 'stickball', 'treadmill', 'eightbit', 'elevator',
  'rings', 'pawprints', 'duck',
]

type ComplexEntry = { name: string; Component: React.ComponentType }
const COMPLEX: ComplexEntry[] = [
  { name: 'cauldron', Component: CauldronLoader },
  { name: 'book3d', Component: Book3dLoader },
]

export default function LoadersPage() {
  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-zinc-100 mb-2">Галерея лоадеров</h1>
      <p className="text-zinc-500 text-sm mb-8">Всего: {SIMPLE.length + COMPLEX.length}. Запомни номера которые хочешь удалить.</p>

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
        {COMPLEX.map(({ name, Component }, i) => (
          <div key={name} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col items-center gap-3 hover:border-zinc-600 transition-colors">
            <div className="text-xs text-zinc-500 self-start">#{SIMPLE.length + i + 1}</div>
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
