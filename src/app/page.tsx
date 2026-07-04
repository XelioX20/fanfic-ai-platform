'use client'
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore, useReaderStore } from '@/store'
import type { Fanfic } from '@/types'

import { ContinueReadingHero, type ReadingProgressEntry } from '@/components/home/ContinueReadingCard'
import { WelcomeHero } from '@/components/home/WelcomeHero'
import { MoodGrid } from '@/components/home/MoodGrid'
import { FanficRail } from '@/components/home/FanficRail'
import { EditorialCollection } from '@/components/home/EditorialCollection'
import { FandomStrip } from '@/components/home/FandomStrip'
import { FooterActions } from '@/components/home/FooterActions'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// ---------- fetchers ----------

async function fetchList(path: string): Promise<Fanfic[]> {
  const res = await fetch(`${API_URL}/api/v1/search/list?path=${encodeURIComponent(path)}&page=1`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return (data.items ?? []) as Fanfic[]
}

async function fetchAuthedList(pathname: string, token: string): Promise<Fanfic[]> {
  const res = await fetch(`${API_URL}/api/v1${pathname}?page=1`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return (data.items ?? []) as Fanfic[]
}

async function fetchForMe(token: string): Promise<Fanfic[]> {
  const res = await fetch(`${API_URL}/api/v1/recommendations/for-me?page=1`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  // Accept a few plausible shapes
  const items = data.items ?? data.recommendations ?? []
  return items as Fanfic[]
}

async function fetchFanficFull(id: string): Promise<Fanfic | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/fanfics/${id}/full`)
    if (!res.ok) return null
    const data = await res.json()
    // The /full endpoint returns a richer object — normalize to Fanfic-ish shape
    return {
      id: data.id,
      title: data.title,
      description: data.description ?? '',
      author_name: data.authors?.[0]?.name ?? '',
      author_id: data.authors?.[0]?.id ?? '',
      fandoms: data.fandoms ?? [],
      pairings: data.pairings ?? [],
      tags: data.tags ?? [],
      direction: data.direction ?? '',
      rating: data.rating ?? '',
      completion_status: data.completion_status ?? '',
      likes: data.likes ?? 0,
      trophies: data.trophies ?? 0,
      words_count: data.words_count ?? 0,
      chapters_count: data.chapters?.length ?? 0,
      comments_count: data.comments_count ?? 0,
      cover_url: data.cover_url,
      ficbook_url: data.ficbook_url ?? '',
      is_hot: data.is_hot ?? false,
      updated_at: data.chapters?.[data.chapters.length - 1]?.date,
      // Extra fields consumed by the ContinueReadingHero chapter-meta derivation.
      _chapters: data.chapters,
      _is_single_chapter: data.is_single_chapter,
    } as unknown as Fanfic
  } catch {
    return null
  }
}

// ---------- helpers ----------

/**
 * Extract up to N most-recent progress entries from the reader store.
 * Zustand's persist middleware preserves insertion order for object keys, and
 * `setReadingProgress` spreads existing state before adding the current key,
 * so the last N keys are effectively the N most recently updated fanfics.
 */
function extractRecentProgress(
  progress: Record<string, number>,
  limit = 5,
): ReadingProgressEntry[] {
  const keys = Object.keys(progress).filter((k) => (progress[k] ?? 0) > 100)
  // Deduplicate by fanficId — keep the last chapter per fic
  const byFic = new Map<string, ReadingProgressEntry>()
  for (const key of keys) {
    const [fanficId, chapterId] = key.split(':')
    if (!fanficId) continue
    byFic.set(fanficId, {
      fanficId,
      chapterId: (chapterId as string) || 'single',
      scrollY: progress[key] ?? 0,
      progressKey: key,
    })
  }
  const all = Array.from(byFic.values())
  return all.slice(-limit).reverse()
}

// ---------- page ----------

export default function HomePage() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const user = useAuthStore((s) => s.user)
  const readingProgress = useReaderStore((s) => s.readingProgress)

  // Avoid hydration mismatches — persisted stores start empty on the server.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])

  const isAuthed = hydrated && !!accessToken
  const isGuest = hydrated && !accessToken

  const recentEntries = useMemo(
    () => (hydrated ? extractRecentProgress(readingProgress, 5) : []),
    [hydrated, readingProgress],
  )
  const primaryEntry = recentEntries[0] ?? null

  // -------- Continue Reading: fetch primary fanfic --------
  const primaryFicQuery = useQuery({
    queryKey: ['fanfic-full', primaryEntry?.fanficId],
    queryFn: () => fetchFanficFull(primaryEntry!.fanficId),
    enabled: !!primaryEntry,
    staleTime: 60 * 1000,
    retry: 1,
  })

  // -------- Public rails (always, cache-friendly) --------
  const trendingQuery = useQuery({
    queryKey: ['home-rail', 'trending'],
    queryFn: () => fetchList('fanfiction'),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const gemsQuery = useQuery({
    queryKey: ['home-rail', 'gems'],
    queryFn: () => fetchList('fanfiction?direction=slash'),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    // reuse "slash" list as source pool; we sort client-side for high-like/low-view
    select: (items) => {
      const sorted = [...items].sort((a, b) => {
        // High likes-per-word (proxy for "high like ratio")
        const aRatio = a.likes / Math.max(1, a.words_count / 1000)
        const bRatio = b.likes / Math.max(1, b.words_count / 1000)
        return bRatio - aRatio
      })
      return sorted.slice(0, 6)
    },
  })

  const beginnerQuery = useQuery({
    queryKey: ['home-rail', 'beginner'],
    queryFn: () => fetchList('fanfiction?direction=gen'),
    staleTime: 10 * 60 * 1000,
    retry: 1,
    enabled: isGuest,
  })

  // -------- Authed rails --------
  const subsQuery = useQuery({
    queryKey: ['home-rail', 'subscriptions'],
    queryFn: () => fetchAuthedList('/profile/subscriptions', accessToken!),
    enabled: isAuthed,
    staleTime: 60 * 1000,
    retry: 0,
  })

  const forMeQuery = useQuery({
    queryKey: ['home-rail', 'for-me'],
    queryFn: () => fetchForMe(accessToken!),
    enabled: isAuthed,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  })

  // -------- Derived: continue-reading chapter meta --------
  const chapterMeta = useMemo(() => {
    const fic = primaryFicQuery.data as (Fanfic & { _chapters?: Array<{ id: string; title: string }>; _is_single_chapter?: boolean }) | null | undefined
    if (!fic || !primaryEntry) return { title: undefined, index: undefined, total: undefined }
    const chapters = fic._chapters ?? []
    const total = chapters.length
    if (primaryEntry.chapterId === 'single' || fic._is_single_chapter) {
      return { title: undefined, index: 1, total: total || 1 }
    }
    const idx = chapters.findIndex((c) => c.id === primaryEntry.chapterId)
    return {
      title: idx >= 0 ? chapters[idx].title : undefined,
      index: idx >= 0 ? idx + 1 : undefined,
      total: total || undefined,
    }
  }, [primaryFicQuery.data, primaryEntry])

  // Heuristic progress percent — scrollY / 12000 clamped to 100.
  // Without measuring chapter height client-side, this is intentionally rough.
  const percent = useMemo(() => {
    if (!primaryEntry) return undefined
    return Math.min(100, Math.max(3, Math.round((primaryEntry.scrollY / 12000) * 100)))
  }, [primaryEntry])

  // -------- Render --------

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-10 md:space-y-14">
        {/* 1 / 2 — Hero: Continue Reading (auth+progress) OR Welcome */}
        {!hydrated ? (
          <div className="h-48 md:h-64 rounded-2xl bg-zinc-900 border border-zinc-800 animate-pulse" />
        ) : isAuthed && primaryEntry ? (
          <ContinueReadingHero
            entry={primaryEntry}
            fanfic={primaryFicQuery.data ?? null}
            loading={primaryFicQuery.isLoading}
            percent={percent}
            chapterTitle={chapterMeta.title}
            chapterIndex={chapterMeta.index}
            chapterTotal={chapterMeta.total}
          />
        ) : (
          <WelcomeHero
            variant={isGuest ? 'guest' : 'authed-caught-up'}
            greeting={
              isAuthed && user?.ficbook_username
                ? `С возвращением, ${user.ficbook_username}`
                : undefined
            }
          />
        )}

        {/* 3 — Mood Grid (always visible) */}
        <MoodGrid />

        {/* 4 — Subscriptions rail (auth only, conditional on non-empty) */}
        {isAuthed && (
          <FanficRail
            title="Новое от подписок"
            subtitle="Свежие главы от авторов, за которыми вы следите"
            fanfics={subsQuery.data ?? []}
            loading={subsQuery.isLoading}
            error={subsQuery.isError}
            seeAllHref="/profile/subscriptions"
          />
        )}

        {/* 5 — Trending (always) */}
        <FanficRail
          title="🔥 Горячее сегодня"
          subtitle="Что читают прямо сейчас"
          fanfics={trendingQuery.data ?? []}
          loading={trendingQuery.isLoading}
          error={trendingQuery.isError}
          seeAllHref="/search?q=популярное"
          emptyLabel="Пусто — попробуйте обновить страницу."
        />

        {/* 6 — For you (auth only) OR beginner rail (guests) */}
        {isAuthed ? (
          <FanficRail
            title="✨ Для вас"
            subtitle="Подобрано на основе ваших лайков и истории"
            fanfics={forMeQuery.data ?? []}
            loading={forMeQuery.isLoading}
            error={forMeQuery.isError}
            emptyLabel="Читайте и лайкайте — рекомендации появятся здесь."
          />
        ) : (
          <FanficRail
            title="👋 С чего начать"
            subtitle="Хорошие входные точки, если вы здесь впервые"
            fanfics={(beginnerQuery.data ?? []).slice(0, 8)}
            loading={beginnerQuery.isLoading}
            error={beginnerQuery.isError}
            skeletonCount={8}
          />
        )}

        {/* 7 — Editorial: Hidden gems */}
        <EditorialCollection
          title="Скрытые жемчужины"
          fanfics={gemsQuery.data ?? []}
          loading={gemsQuery.isLoading}
        />

        {/* 8 — Fandom shortcuts */}
        <FandomStrip />

        {/* 9 — Footer nudge */}
        <FooterActions isGuest={isGuest} />
      </div>
    </main>
  )
}
