'use client'
import { useEffect, useState } from 'react'
import { Heart, BookCheck, Bell } from 'lucide-react'
import { useAuthStore } from '@/store'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface State {
  is_liked: boolean
  is_read: boolean
  is_followed: boolean
}

// Shared cache across all card instances
const stateCache = new Map<string, State>()

export function FanficStateBadges({ fanficId }: { fanficId: string }) {
  const { accessToken } = useAuthStore()
  const [state, setState] = useState<State | null>(() => stateCache.get(fanficId) ?? null)

  useEffect(() => {
    if (!accessToken || !fanficId) return
    if (stateCache.has(fanficId)) {
      setState(stateCache.get(fanficId)!)
      return
    }
    fetch(`${API_URL}/api/v1/actions/state/${fanficId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        const s = { is_liked: !!d.is_liked, is_read: !!d.is_read, is_followed: !!d.is_followed }
        stateCache.set(fanficId, s)
        setState(s)
      })
      .catch(() => {})
  }, [fanficId, accessToken])

  if (!accessToken || !state) return null
  if (!state.is_liked && !state.is_read && !state.is_followed) return null

  return (
    <div className="absolute top-2 right-2 flex gap-1 z-10">
      {state.is_liked && (
        <span title="В избранном" className="flex items-center justify-center w-6 h-6 rounded-full bg-pink-900/80 border border-pink-600/60 backdrop-blur-sm">
          <Heart size={11} className="fill-pink-300 text-pink-300" />
        </span>
      )}
      {state.is_read && (
        <span title="Прочитано" className="flex items-center justify-center w-6 h-6 rounded-full bg-teal-900/80 border border-teal-600/60 backdrop-blur-sm">
          <BookCheck size={11} className="text-teal-300" />
        </span>
      )}
      {state.is_followed && (
        <span title="Подписан на обновления" className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-900/80 border border-purple-600/60 backdrop-blur-sm">
          <Bell size={11} className="text-purple-300" />
        </span>
      )}
    </div>
  )
}
