'use client'
import { Sun, Moon } from 'lucide-react'
import { REGISTRY, type LoaderEntry } from '@/components/ui/Loader'
import styles from '@/components/ui/loaders.module.css'
import ctl from './controls.module.css'
import { useLoaderPrefs, type LoaderMode, isLoaderEnabled } from '@/store/loaderPrefs'
import { useUIStore } from '@/store'
import { cn } from '@/lib/utils'

type ScopeMode = 'all' | 'light' | 'dark'
const SCOPE_OPTIONS: { value: ScopeMode; label: React.ReactNode }[] = [
  { value: 'all',   label: 'All' },
  { value: 'light', label: <span className="inline-flex items-center gap-1"><Sun size={11} strokeWidth={2.4} /> Light</span> },
  { value: 'dark',  label: <span className="inline-flex items-center gap-1"><Moon size={11} strokeWidth={2.4} /> Dark</span> },
]

function renderLoader(entry: LoaderEntry) {
  if (entry.kind === 'complex') {
    const Component = entry.Component
    return <Component />
  }
  return <div className={(styles as Record<string, string>)[entry.name]} role="presentation" />
}

// Split the persisted single-mode into two dimensions: is-on + scope
function splitMode(m: LoaderMode | undefined): { on: boolean; scope: ScopeMode } {
  if (m === 'off') return { on: false, scope: 'all' }
  if (m === 'light' || m === 'dark') return { on: true, scope: m }
  return { on: true, scope: 'all' }
}
function combineMode(on: boolean, scope: ScopeMode): LoaderMode {
  if (!on) return 'off'
  if (scope === 'all') return 'all'
  return scope
}

// Effective scope shown in UI: if the loader has a built-in restriction, the
// user's persisted "all" collapses to the actual theme where it works (light-only
// → 'light'). This makes the tab highlight match reality.
function effectiveScope(scope: ScopeMode, forcedThemes: LoaderEntry['themes']): ScopeMode {
  if (scope !== 'all') return scope
  if (!forcedThemes || forcedThemes.length === 3) return 'all'
  const hasLight = forcedThemes.includes('light')
  const hasDark  = forcedThemes.includes('dark') || forcedThemes.includes('amoled')
  if (hasLight && !hasDark) return 'light'
  if (!hasLight && hasDark) return 'dark'
  return 'all'
}

// Which tabs to show for a given loader. Restricted loaders drop "All" and
// disable the theme they don't support, so the tab row can't lie.
function visibleScopes(forcedThemes: LoaderEntry['themes']): ScopeMode[] {
  if (!forcedThemes || forcedThemes.length === 3) return ['all', 'light', 'dark']
  const hasLight = forcedThemes.includes('light')
  const hasDark  = forcedThemes.includes('dark') || forcedThemes.includes('amoled')
  if (hasLight && !hasDark) return ['light', 'dark']  // light-only: show both, disable dark
  if (!hasLight && hasDark) return ['light', 'dark']  // dark-only: show both, disable light
  return ['all', 'light', 'dark']
}

// A user-selectable scope 'X' can conflict with the loader's built-in themes allow-list.
function scopeConflicts(scope: ScopeMode, forcedThemes: LoaderEntry['themes']) {
  if (!forcedThemes || forcedThemes.length === 3) return false
  if (scope === 'light') return !forcedThemes.includes('light')
  if (scope === 'dark')  return !forcedThemes.includes('dark') && !forcedThemes.includes('amoled')
  return false
}

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
          const { on, scope } = splitMode(modes[entry.name])
          const forcedThemes = entry.themes
          const uiScope = effectiveScope(scope, forcedThemes)
          const tabsToShow = visibleScopes(forcedThemes)
          const shownOptions = SCOPE_OPTIONS.filter(o => tabsToShow.includes(o.value))
          const selectedIndex = shownOptions.findIndex(o => o.value === uiScope)

          return (
            <div
              key={entry.name}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col items-stretch gap-3 hover:border-zinc-600 transition-colors h-full"
            >
              {/* Top row: on/off switch (left) + theme-restriction badge (right) + index */}
              <div className="flex items-center justify-between gap-2">
                <label className={ctl.switch}>
                  <input
                    className={ctl.cb}
                    type="checkbox"
                    checked={on}
                    onChange={e => setMode(entry.name, combineMode(e.target.checked, scope))}
                    aria-label={`Включить лоадер ${entry.name}`}
                  />
                  <span className={ctl.toggle}>
                    <span className={ctl.left}>off</span>
                    <span className={ctl.right}>on</span>
                  </span>
                </label>

                <div className="flex items-center gap-2">
                  {forcedThemes && forcedThemes.length < 3 && (
                    <span
                      className="text-[10px] uppercase text-amber-400 bg-amber-900/40 border border-amber-700/40 px-1.5 py-0.5 rounded"
                      title={`Разрешено только: ${forcedThemes.join(', ')}`}
                    >
                      {themeBadgeLabel(forcedThemes)}
                    </span>
                  )}
                  <span className="text-xs text-zinc-500">#{i + 1}</span>
                </div>
              </div>

              {/* Loader preview */}
              <div className="flex items-center justify-center min-h-[120px] w-full overflow-hidden py-2">
                {renderLoader(entry)}
              </div>

              {/* Name + scope tabs pinned to bottom */}
              <div className="mt-auto flex flex-col gap-2">
                <p className="text-zinc-300 text-xs font-mono text-center">{entry.name}</p>

                <div
                  className={ctl.tabs}
                  data-tabs={shownOptions.length}
                  data-selected={selectedIndex}
                  {...(on ? {} : { 'aria-disabled': 'true' as const })}
                >
                {shownOptions.map((opt, idx) => {
                  const conflict = scopeConflicts(opt.value, forcedThemes)
                  const inputId = `scope-${entry.name}-${opt.value}`
                  const isDisabled = !on || conflict
                  return (
                    <>
                      <input
                        key={`${inputId}-in`}
                        id={inputId}
                        type="radio"
                        name={`scope-${entry.name}`}
                        checked={uiScope === opt.value}
                        disabled={isDisabled}
                        onChange={() => setMode(entry.name, combineMode(true, opt.value))}
                      />
                      <label
                        key={`${inputId}-lbl`}
                        htmlFor={inputId}
                        className={cn(ctl.tab, isDisabled && ctl.disabled)}
                        title={
                          !on
                            ? 'Включите переключатель on/off слева'
                            : conflict
                              ? 'Недоступно из-за встроенного ограничения'
                              : opt.value === 'all' ? 'Во всех темах'
                              : opt.value === 'light' ? 'Только в светлой теме'
                              : 'Только в тёмной теме (dark + amoled)'
                        }
                      >
                        {opt.label}
                      </label>
                      {idx === shownOptions.length - 1 && <span key={`${inputId}-gl`} className={ctl.glider} />}
                    </>
                  )
                })}
                </div>
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
