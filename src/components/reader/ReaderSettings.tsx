'use client'
import { Settings, Sun, Moon, Smartphone, X } from 'lucide-react'
import { useState } from 'react'
import { useReaderStore } from '@/store'
import { Button } from '@/components/ui/button'
import type { Theme } from '@/types'

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
              <label className="text-xs text-zinc-500 block mb-2">Тема</label>
              <div className="flex gap-1.5">
                {(['light', 'dark', 'amoled'] as Theme[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => updateSettings({ theme: t })}
                    className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs border transition-colors ${
                      settings.theme === t
                        ? 'bg-purple-600 border-purple-600 text-white'
                        : 'border-zinc-600 text-zinc-400 hover:border-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {t === 'light' ? <Sun size={11} /> : t === 'dark' ? <Moon size={11} /> : <Smartphone size={11} />}
                    <span>{t === 'amoled' ? 'AMOLED' : t === 'light' ? 'Светлая' : 'Тёмная'}</span>
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
