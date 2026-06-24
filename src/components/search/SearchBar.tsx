'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface SearchBarProps {
  defaultValue?: string
  className?: string
  onSearch?: (query: string) => void
}

export function SearchBar({ defaultValue = '', className, onSearch }: SearchBarProps) {
  const [value, setValue] = useState(defaultValue)
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!value.trim()) return
    if (onSearch) {
      onSearch(value.trim())
    } else {
      router.push(`/search?q=${encodeURIComponent(value.trim())}`)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cn('relative', className)}>
      <div className="relative flex items-center">
        <Search size={16} className="absolute left-3 text-zinc-500 pointer-events-none" />
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Хочу законченный ангст на 300 тысяч слов..."
          className="pl-9 pr-10"
        />
        {value && (
          <button
            type="button"
            onClick={() => setValue('')}
            className="absolute right-3 text-zinc-500 hover:text-zinc-300"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </form>
  )
}
