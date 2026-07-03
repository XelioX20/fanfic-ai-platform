'use client'
import { useState, useEffect } from 'react'
import { Heart, BookCheck, Bell, BellOff, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store'
import { cn } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface FanficActionsProps {
  fanficId: string
  compact?: boolean
}

interface State {
  is_liked: boolean
  is_read: boolean
  is_followed: boolean
}

// Cache state per fanfic ID across component instances
const stateCache = new Map<string, State>()

export function FanficActions({ fanficId, compact = false }: FanficActionsProps) {
  const { accessToken } = useAuthStore()
  const [state, setState] = useState<State>(() =>
    stateCache.get(fanficId) ?? { is_liked: false, is_read: false, is_followed: false }
  )
  const [loading, setLoading] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken || !fanficId) return
    // Skip fetch if we already have cached state for this fanfic
    if (stateCache.has(fanficId)) {
      setState(stateCache.get(fanficId)!)
      return
    }
    fetch(`${API_URL}/api/v1/actions/state/${fanficId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(r => r.json())
      .then(d => {
        const s = { is_liked: !!d.is_liked, is_read: !!d.is_read, is_followed: !!d.is_followed }
        stateCache.set(fanficId, s)
        setState(s)
      })
      .catch(() => {})
  }, [fanficId, accessToken])

  if (!accessToken) return null

  const doAction = async (action: string) => {
    setLoading(action)
    try {
      const resp = await fetch(`${API_URL}/api/v1/actions/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ fanfic_id: fanficId }),
      })
      const data = await resp.json()
      if (data.success) {
        const newState = { ...state }
        if (action === 'like') newState.is_liked = true
        if (action === 'unlike') newState.is_liked = false
        if (action === 'mark-read') newState.is_read = true
        if (action === 'mark-unread') newState.is_read = false
        if (action === 'follow') newState.is_followed = true
        if (action === 'unfollow') newState.is_followed = false
        stateCache.set(fanficId, newState)
        setState(newState)
      }
    } catch {}
    setLoading(null)
  }

  const stopClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div className={cn('flex flex-wrap items-center', compact ? 'gap-1' : 'gap-2')}>
      {/* Like */}
      <button
        type="button"
        onClick={(e) => { stopClick(e); doAction(state.is_liked ? 'unlike' : 'like') }}
        disabled={loading === 'like' || loading === 'unlike'}
        title={state.is_liked ? 'Убрать лайк' : 'Лайкнуть'}
        className={cn(
          'flex items-center gap-1.5 rounded-lg text-xs font-medium border transition-all',
          state.is_liked
            ? 'bg-pink-900/70 text-pink-200 border-pink-600/70 shadow-sm shadow-pink-950/50'
            : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-pink-300 hover:border-pink-700/50',
          compact ? 'px-2 py-1' : 'px-2.5 py-1.5'
        )}
      >
        {(loading === 'like' || loading === 'unlike')
          ? <Loader2 size={12} className="animate-spin" />
          : <Heart size={12} className={state.is_liked ? 'fill-pink-300 text-pink-300' : ''} />
        }
        {!compact && <span className="hidden sm:inline">{state.is_liked ? 'В избранном' : 'В избранное'}</span>}
      </button>

      {/* Mark read */}
      <button
        type="button"
        onClick={(e) => { stopClick(e); doAction(state.is_read ? 'mark-unread' : 'mark-read') }}
        disabled={loading === 'mark-read' || loading === 'mark-unread'}
        title={state.is_read ? 'Отметить непрочитанным' : 'Отметить прочитанным'}
        className={cn(
          'flex items-center gap-1.5 rounded-lg text-xs font-medium border transition-all',
          state.is_read
            ? 'bg-teal-900/70 text-teal-200 border-teal-600/70 shadow-sm shadow-teal-950/50'
            : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-teal-300 hover:border-teal-700/50',
          compact ? 'px-2 py-1' : 'px-2.5 py-1.5'
        )}
      >
        {(loading === 'mark-read' || loading === 'mark-unread')
          ? <Loader2 size={12} className="animate-spin" />
          : <BookCheck size={12} className={state.is_read ? 'text-teal-300' : ''} />
        }
        {!compact && <span className="hidden sm:inline">{state.is_read ? 'Прочитано' : 'Отметить прочитанным'}</span>}
      </button>

      {/* Follow */}
      <button
        type="button"
        onClick={(e) => { stopClick(e); doAction(state.is_followed ? 'unfollow' : 'follow') }}
        disabled={loading === 'follow' || loading === 'unfollow'}
        title={state.is_followed ? 'Отписаться' : 'Подписаться на обновления'}
        className={cn(
          'flex items-center gap-1.5 rounded-lg text-xs font-medium border transition-all',
          state.is_followed
            ? 'bg-purple-900/70 text-purple-200 border-purple-600/70 shadow-sm shadow-purple-950/50'
            : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-purple-300 hover:border-purple-700/50',
          compact ? 'px-2 py-1' : 'px-2.5 py-1.5'
        )}
      >
        {(loading === 'follow' || loading === 'unfollow')
          ? <Loader2 size={12} className="animate-spin" />
          : state.is_followed ? <BellOff size={12} className="text-purple-300" /> : <Bell size={12} />
        }
        {!compact && <span className="hidden sm:inline">{state.is_followed ? 'Подписан' : 'Следить'}</span>}
      </button>
    </div>
  )
}
