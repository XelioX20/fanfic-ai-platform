'use client'
import { useState, useRef, useEffect } from 'react'
import { Download, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  fanficId: string
}

const FORMATS = [
  { ext: 'txt',  label: 'TXT',  desc: 'Обычный текст' },
  { ext: 'epub', label: 'EPUB', desc: 'Читалки, iBooks' },
  { ext: 'pdf',  label: 'PDF',  desc: 'Универсальный' },
  { ext: 'fb2',  label: 'FB2',  desc: 'Русские читалки' },
]

export function DownloadButton({ fanficId }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'inline-flex items-center gap-2 px-4 py-2 border border-zinc-700 hover:bg-zinc-800 text-zinc-300 rounded-md text-sm transition-colors'
        )}
      >
        <Download size={14} /> Скачать <ChevronDown size={12} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-56 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 py-1 overflow-hidden">
          {FORMATS.map(f => (
            <a
              key={f.ext}
              href={`https://ficbook.net/readfic/${fanficId}/download`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              <span className="font-medium">{f.label}</span>
              <span className="text-zinc-500 text-xs">{f.desc}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
