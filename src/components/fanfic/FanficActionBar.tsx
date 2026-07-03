'use client'
import { useState, useEffect } from 'react'
import { Heart, Bell, MessageSquare, FolderPlus, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store'
import { cn } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface Props {
  fanficId: string
  likesCount?: number
  commentsCount?: number
}

interface State {
  is_liked: boolean
  is_followed: boolean
}

export function FanficActionBar({ fanficId, likesCount = 0, commentsCount = 0 }: Props) {
  const { accessToken } = useAuthStore()
  const [state, setState] = useState<State>({ is_liked: false, is_followed: false })
  const [loading, setLoading] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken || !fanficId) return
    fetch(`${API_URL}/api/v1/actions/state/${fanficId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(r => r.json())
      .then(d => setState({ is_liked: !!d.is_liked, is_followed: !!d.is_followed }))
      .catch(() => {})
  }, [fanficId, accessToken])

  const doAction = async (action: string) => {
    if (!accessToken) return
    setLoading(action)
    try {
      const r = await fetch(`${API_URL}/api/v1/actions/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ fanfic_id: fanficId }),
      })
      const d = await r.json()
      if (d.success) {
        if (action === 'like') setState(s => ({ ...s, is_liked: true }))
        if (action === 'unlike') setState(s => ({ ...s, is_liked: false }))
        if (action === 'follow') setState(s => ({ ...s, is_followed: true }))
        if (action === 'unfollow') setState(s => ({ ...s, is_followed: false }))
      }
    } catch {}
    setLoading(null)
  }

  const btn = (
    active: boolean,
    onClick: (() => void) | undefined,
    Icon: typeof Heart,
    label: string,
    count?: number,
    activeClass?: string,
    href?: string,
  ) => {
    const inner = (
      <>
        {loading === label
          ? <Loader2 size={14} className="animate-spin" />
          : <Icon size={14} className={active ? 'fill-current' : ''} />}
        <span>{label}</span>
        {typeof count === 'number' && count > 0 && (
          <span className="text-xs opacity-80">({count})</span>
        )}
      </>
    )
    const className = cn(
      'inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium border transition-all',
      active
        ? (activeClass ?? 'bg-purple-600/20 border-purple-500 text-purple-300')
        : 'bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800'
    )
    if (href) {
      return <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{inner}</a>
    }
    return <button type="button" onClick={onClick} disabled={!accessToken} className={cn(className, !accessToken && 'opacity-60 cursor-not-allowed')}>{inner}</button>
  }

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {btn(state.is_liked, () => doAction(state.is_liked ? 'unlike' : 'like'), Heart, 'Нравится', likesCount, 'bg-pink-900/40 border-pink-600 text-pink-300')}
      {btn(state.is_followed, () => doAction(state.is_followed ? 'unfollow' : 'follow'), Bell, 'Подписаться', undefined, 'bg-purple-900/40 border-purple-600 text-purple-300')}
      {btn(false, undefined, MessageSquare, 'Отзывы', commentsCount, undefined, `https://ficbook.net/readfic/${fanficId}/comments#comments-list`)}
      {btn(false, undefined, FolderPlus, 'В сборник', undefined, undefined, `https://ficbook.net/readfic/${fanficId}`)}
    </div>
  )
}
