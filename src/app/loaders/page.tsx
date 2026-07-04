'use client'
import { REGISTRY, type LoaderEntry } from '@/components/ui/Loader'
import styles from '@/components/ui/loaders.module.css'
import { useLoaderPrefs, type LoaderMode, isLoaderEnabled } from '@/store/loaderPrefs'
import { useUIStore } from '@/store'
import { cn } from '@/lib/utils'

const MODE_OPTIONS: { value: LoaderMode; label: string; hint: string }[] = [
  { value: 'off',   label: 'Off',   hint: 'Никогда' },
  { value: 'all',   label: 'On',    hint: 'Все темы' },
  { value: 'light', label: '☀',     hint: 'Только светлая' },
  { value: 'dark',  label: '🌙',    hint: 'Только тёмная (dark + AMOLED)' },
]

function renderLoader(entry: LoaderEntry) {
  if (entry.kind === 'complex') {
    const Component = entry.Component
    return <Component />
  }
  return <div className={(styles as Record<string, string>)[entry.name]} role="presentation" />
}

// A user-selectable mode 'X' can conflict with the loader's built-in themes allow-list.
// 'light' conflicts if the loader is dark-only.
// 'dark' conflicts if the loader is light-only.
function modeConflicts(mode: LoaderMode, forcedThemes: LoaderEntry['themes']) {
  if (!forcedThemes || forcedThemes.length === 3) return false
  if (mode === 'light') return !forcedThemes.includes('light')
  if (mode === 'dark') return !forcedThemes.includes('dark') && !forcedThemes.includes('amoled')
  return false
}

// Human-readable label for the loader's built-in theme restriction badge.
function themeBadgeLabel(themes: NonNullable<LoaderEntry['themes']>) {
  const hasLight = themes.includes('light')
  const hasDark  = themes.includes('dark') || themes.includes('amoled')
  if (hasLight && !hasDark) return 'light-only'
  if (!hasLight && hasDark) return 'dark-only'
  return themes.join('/')
}

export default function LoadersPage() {
  const { modes, setMode, reset } = useLoaderPrefs()
  const siteTheme = useUIStore(s => s.theme) as 'light' | 'dark' | 'amoled'

  const total = REGISTRY.length
  const enabledForCurrentTheme = REGISTRY.filter(e =>
    isLoaderEnabled(e.name, siteTheme, e.themes, modes[e.name])
  ).length
  const offCount = Object.values(modes).filter(m => m === 'off').length

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-zinc-100 mb-2">Галерея лоадеров</h1>
      <p className="text-zinc-500 text-sm mb-2">
        Всего: {total}. Активно в текущей теме ({String(siteTheme)}): <span className="text-zinc-300">{enabledForCurrentTheme}</span>. Выключено: {offCount}.
      </p>
      <div className="flex gap-2 mb-8">
        <button
          type="button"
          onClick={() => reset()}
          className="text-xs text-zinc-500 hover:text-zinc-300 underline"
        >
          Сбросить настройки
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {REGISTRY.map((entry, i) => {
          const currentMode = modes[entry.name] ?? 'all'
          const forcedThemes = entry.themes
          return (
            <div
              key={entry.name}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col items-stretch gap-3 hover:border-zinc-600 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="text-xs text-zinc-500">#{i + 1}</div>
                {forcedThemes && forcedThemes.length < 3 && (
                  <span
                    className="text-[10px] uppercase text-amber-400 bg-amber-900/40 border border-amber-700/40 px-1.5 py-0.5 rounded"
                    title={`Разрешено только: ${forcedThemes.join(', ')}`}
                  >
                    {themeBadgeLabel(forcedThemes)}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-center min-h-[100px] w-full overflow-hidden">
                {renderLoader(entry)}
              </div>

              <p className="text-zinc-300 text-xs font-mono text-center">{entry.name}</p>

              {/* Segmented control */}
              <div className="grid grid-cols-4 gap-1 mt-auto">
                {MODE_OPTIONS.map(opt => {
                  const isSelected = currentMode === opt.value
                  const conflict = modeConflicts(opt.value, forcedThemes)
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      title={opt.hint}
                      disabled={conflict}
                      onClick={() => setMode(entry.name, opt.value)}
                      className={cn(
                        'px-1 py-1 text-xs rounded border text-center transition-colors',
                        isSelected
                          ? 'bg-purple-600 border-purple-500 text-white'
                          : conflict
                            ? 'bg-zinc-950 border-zinc-800 text-zinc-700 cursor-not-allowed'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                      )}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-zinc-600 text-xs mt-8 text-center">
        Настройки сохраняются в браузере (localStorage). Влияют на то какой лоадер выбирается случайно в реальных загрузках страниц.
      </p>
    </main>
  )
}
