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

export function FanficActions({ fanficId, compact = false }: FanficActionsProps) {
  const { accessToken } = useAuthStore()
  const [state, setState] = useState<State>({ is_liked: false, is_read: false, is_followed: false })
  const [loading, setLoading] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (!accessToken || !fanficId) return
    fetch(`${API_URL}/api/v1/actions/state/${fanficId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(r => r.json())
      .then(d => { setState(d); setInitialized(true) })
      .catch(() => setInitialized(true))
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
        if (action === 'like') setState(s => ({ ...s, is_liked: true }))
        if (action === 'unlike') setState(s => ({ ...s, is_liked: false }))
        if (action === 'mark-read') setState(s => ({ ...s, is_read: true }))
        if (action === 'mark-unread') setState(s => ({ ...s, is_read: false }))
        if (action === 'follow') setState(s => ({ ...s, is_followed: true }))
        if (action === 'unfollow') setState(s => ({ ...s, is_followed: false }))
      }
    } catch {}
    setLoading(null)
  }

  if (!initialized) return null

  return (
    <div className={cn('flex items-center gap-2', compact ? 'gap-1' : 'gap-2')}>
      {/* Like */}
      <button
        type="button"
        onClick={() => doAction(state.is_liked ? 'unlike' : 'like')}
        disabled={loading === 'like' || loading === 'unlike'}
        title={state.is_liked ? 'Убрать лайк' : 'Лайкнуть'}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all',
          state.is_liked
            ? 'bg-pink-900/60 text-pink-300 border-pink-700/60 hover:bg-pink-900/40'
            : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-pink-300 hover:border-pink-700/40',
          compact && 'px-2 py-1'
        )}
      >
        {(loading === 'like' || loading === 'unlike')
          ? <Loader2 size={12} className="animate-spin" />
          : <Heart size={12} className={state.is_liked ? 'fill-pink-400' : ''} />
        }
        {!compact && <span>{state.is_liked ? 'Нравится' : 'Лайк'}</span>}
      </button>

      {/* Mark read */}
      <button
        type="button"
        onClick={() => doAction(state.is_read ? 'mark-unread' : 'mark-read')}
        disabled={loading === 'mark-read' || loading === 'mark-unread'}
        title={state.is_read ? 'Отметить непрочитанным' : 'Отметить прочитанным'}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all',
          state.is_read
            ? 'bg-teal-900/60 text-teal-300 border-teal-700/60 hover:bg-teal-900/40'
            : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-teal-300 hover:border-teal-700/40',
          compact && 'px-2 py-1'
        )}
      >
        {(loading === 'mark-read' || loading === 'mark-unread')
          ? <Loader2 size={12} className="animate-spin" />
          : <BookCheck size={12} className={state.is_read ? 'text-teal-400' : ''} />
        }
        {!compact && <span>{state.is_read ? 'Прочитано' : 'Прочитано?'}</span>}
      </button>

      {/* Follow */}
      <button
        type="button"
        onClick={() => doAction(state.is_followed ? 'unfollow' : 'follow')}
        disabled={loading === 'follow' || loading === 'unfollow'}
        title={state.is_followed ? 'Отписаться' : 'Подписаться на обновления'}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all',
          state.is_followed
            ? 'bg-purple-900/60 text-purple-300 border-purple-700/60 hover:bg-purple-900/40'
            : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-purple-300 hover:border-purple-700/40',
          compact && 'px-2 py-1'
        )}
      >
        {(loading === 'follow' || loading === 'unfollow')
          ? <Loader2 size={12} className="animate-spin" />
          : state.is_followed ? <BellOff size={12} /> : <Bell size={12} />
        }
        {!compact && <span>{state.is_followed ? 'Подписан' : 'Следить'}</span>}
      </button>
    </div>
  )
}
