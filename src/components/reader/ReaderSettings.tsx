'use client'
import { Settings, X } from 'lucide-react'
import { useState } from 'react'
import { useReaderStore } from '@/store'
import { Button } from '@/components/ui/button'
import type { ReaderTheme } from '@/types'

interface ReaderThemeOption {
  value: ReaderTheme
  label: string
  swatch: string
  border?: string
}

const READER_THEMES: ReaderThemeOption[] = [
  { value: 'light', label: 'Светлый', swatch: '#ffffff', border: '#d4d4d8' },
  { value: 'dark', label: 'Тёмный', swatch: '#1a1a1a' },
  { value: 'amoled', label: 'AMOLED', swatch: '#000000' },
  { value: 'sepia', label: 'Сепия', swatch: '#f4ecd8' },
  { value: 'paper', label: 'Бумага', swatch: '#faf7f2', border: '#e5e2dc' },
]

export function ReaderSettingsPanel() {
  const [open, setOpen] = useState(false)
  const { settings, updateSettings } = useReaderStore()

  return (
    <div className="relative">
      <Button variant="ghost" size="sm" onClick={() => setOpen(!open)}>
        <Settings size={16} />
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl p-4 z-50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-zinc-300">Настройки чтения</h3>
            <button
              onClick={() => setOpen(false)}
              className="text-zinc-500 hover:text-zinc-200 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-zinc-500 block mb-2">Режим чтения</label>
              <div className="grid grid-cols-5 gap-1.5">
                {READER_THEMES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => updateSettings({ theme: t.value })}
                    title={t.label}
                    className={`flex flex-col items-center gap-1 px-1 py-1.5 rounded text-[10px] border transition-colors ${
                      settings.theme === t.value
                        ? 'bg-purple-600/20 border-purple-500 text-purple-200'
                        : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                    }`}
                  >
                    <span
                      className="w-5 h-5 rounded-full border"
                      style={{
                        backgroundColor: t.swatch,
                        borderColor: t.border ?? 'rgba(255,255,255,0.15)',
                      }}
                    />
                    <span className="leading-tight">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-500 block mb-2">Размер шрифта: {settings.font_size}px</label>
              <input
                type="range" min="12" max="24" step="1"
                value={settings.font_size}
                onChange={(e) => updateSettings({ font_size: Number(e.target.value) })}
                className="w-full"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-500 block mb-2">Межстрочный интервал: {settings.line_height}</label>
              <input
                type="range" min="1.2" max="2.5" step="0.1"
                value={settings.line_height}
                onChange={(e) => updateSettings({ line_height: Number(e.target.value) })}
                className="w-full"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-500 block mb-2">Шрифт</label>
              <div className="flex gap-2">
                <Button
                  variant={settings.font_family === 'serif' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateSettings({ font_family: 'serif' })}
                >
                  Serif
                </Button>
                <Button
                  variant={settings.font_family === 'sans' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateSettings({ font_family: 'sans' })}
                >
                  Sans
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
