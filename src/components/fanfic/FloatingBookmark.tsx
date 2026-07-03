'use client'
import { useState, useEffect } from 'react'
import { Bookmark } from 'lucide-react'
import { useAuthStore } from '@/store'
import { cn } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface Props {
  fanficId: string
}

export function FloatingBookmark({ fanficId }: Props) {
  const { accessToken } = useAuthStore()
  const [isRead, setIsRead] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!accessToken || !fanficId) return
    fetch(`${API_URL}/api/v1/actions/state/${fanficId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(r => r.json())
      .then(d => setIsRead(!!d.is_read))
      .catch(() => {})
  }, [fanficId, accessToken])

  if (!accessToken) return null

  const toggle = async () => {
    setLoading(true)
    try {
      const action = isRead ? 'mark-unread' : 'mark-read'
      const r = await fetch(`${API_URL}/api/v1/actions/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ fanfic_id: fanficId }),
      })
      const d = await r.json()
      if (d.success) setIsRead(!isRead)
    } catch {}
    setLoading(false)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      title={isRead ? 'Отметить непрочитанным' : 'Отметить прочитанным'}
      className={cn(
        'fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all',
        isRead
          ? 'bg-purple-600 text-white hover:bg-purple-700'
          : 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700'
      )}
    >
      <Bookmark size={18} className={isRead ? 'fill-current' : ''} />
    </button>
  )
}
