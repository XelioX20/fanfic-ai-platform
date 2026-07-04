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

// ---------- fetchers ----------
//
// Public rails (trending / gems / beginner) fetch through the Next.js API
// proxy at /api/ficbook/list which fronts the Cloudflare Worker — this avoids
// spinning up the FastAPI cold-start on Render for cache-friendly data.
//
// Auth-scoped calls (Continue Reading /full, /profile/*, /recommendations/*)
// go through the FastAPI backend directly; those endpoints landed in the
// backend milestone commit — see docs/ux-synthesis-2026-07-04.md.

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const RAIL_PATH_TRENDING = 'popular-fanfics-376846'
const RAIL_PATH_SLASH    = 'popular-fanfics-376846/slash-fics-ngf3487tnsfb'
const RAIL_PATH_GEN      = 'popular-fanfics-376846/gen'

async function fetchList(path: string): Promise<Fanfic[]> {
  const res = await fetch(`/api/ficbook/list?path=${encodeURIComponent(path)}&p=1`)
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
  const items = data.items ?? data.recommendations ?? []
  return items as Fanfic[]
}

interface FullFic {
  id: string
  title: string
  description?: string
  authors?: Array<{ name: string; id: string }>
  fandoms?: string[]
  pairings?: Array<{ characters: string[]; is_highlight: boolean }>
  tags?: Array<{ name: string; is_adult: boolean }>
  direction?: string
  rating?: string
  completion_status?: string
  likes?: number
  trophies?: number
  words_count?: number
  comments_count?: number
  cover_url?: string | null
  ficbook_url?: string
  is_hot?: boolean
  chapters?: Array<{ id: string; title: string; date: string; words_count: number }>
  is_single_chapter?: boolean
}

async function fetchFanficFull(id: string): Promise<(Fanfic & FullFic) | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/fanfics/${id}/full`)
    if (!res.ok) return null
    const data = (await res.json()) as FullFic
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
      cover_url: data.cover_url ?? undefined,
      ficbook_url: data.ficbook_url ?? '',
      is_hot: data.is_hot ?? false,
      // extra fields consumed below for chapter-meta derivation
      chapters: data.chapters,
      is_single_chapter: data.is_single_chapter,
    } as Fanfic & FullFic
  } catch {
    return null
  }
}

// ---------- helpers ----------

/**
 * Extract up to N most-recent progress entries from the reader store.
 *
 * The reader store stores `{ scrollY, updatedAt }` per key when available, but
 * legacy entries persist as a plain number (scrollY). We accept both shapes and
 * sort by updatedAt desc; entries without a timestamp fall back to their
 * insertion-order slot (last known reasonable proxy for recency).
 *
 * Threshold `scrollY > 800px` filters accidental scrolls — a typical chapter
 * top has ~600px of chrome, so 800 means the user actually engaged with text.
 */
function extractRecentProgress(
  progress: Record<string, number | { scrollY: number; updatedAt?: number }>,
  limit = 5,
): ReadingProgressEntry[] {
  type Row = ReadingProgressEntry & { updatedAt: number; insertionRank: number }
  const rows: Row[] = []
  let rank = 0
  for (const [key, raw] of Object.entries(progress)) {
    const scrollY = typeof raw === 'number' ? raw : (raw?.scrollY ?? 0)
    const updatedAt = typeof raw === 'number' ? 0 : (raw?.updatedAt ?? 0)
    if (scrollY <= 800) continue
    const [fanficId, chapterId] = key.split(':')
    if (!fanficId) continue
    rows.push({
      fanficId,
      chapterId: chapterId || 'single',
      scrollY,
      progressKey: key,
      updatedAt,
      insertionRank: rank++,
    })
  }
  // Deduplicate by fanficId — keep the highest-updatedAt (or last insertion) row per fic
  const byFic = new Map<string, Row>()
  for (const r of rows) {
    const existing = byFic.get(r.fanficId)
    if (!existing) { byFic.set(r.fanficId, r); continue }
    const rScore = r.updatedAt || r.insertionRank
    const eScore = existing.updatedAt || existing.insertionRank
    if (rScore >= eScore) byFic.set(r.fanficId, r)
  }
  const all = Array.from(byFic.values())
  all.sort((a, b) => {
    const aScore = a.updatedAt || a.insertionRank
    const bScore = b.updatedAt || b.insertionRank
    return bScore - aScore
  })
  return all.slice(0, limit).map(({ fanficId, chapterId, scrollY, progressKey }) => ({
    fanficId, chapterId, scrollY, progressKey,
  }))
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
    queryFn: () => fetchList(RAIL_PATH_TRENDING),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const gemsQuery = useQuery({
    queryKey: ['home-rail', 'gems'],
    queryFn: () => fetchList(RAIL_PATH_SLASH),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    select: (items) => {
      const sorted = [...items].sort((a, b) => {
        const aRatio = a.likes / Math.max(1, a.words_count / 1000)
        const bRatio = b.likes / Math.max(1, b.words_count / 1000)
        return bRatio - aRatio
      })
      return sorted.slice(0, 6)
    },
  })

  const beginnerQuery = useQuery({
    queryKey: ['home-rail', 'beginner'],
    queryFn: () => fetchList(RAIL_PATH_GEN),
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
    const fic = primaryFicQuery.data
    if (!fic || !primaryEntry) return { title: undefined, index: undefined, total: undefined }
    const chapters = fic.chapters ?? []
    const total = chapters.length
    if (primaryEntry.chapterId === 'single' || fic.is_single_chapter) {
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

        {/* 4 — Subscriptions rail (auth only) */}
        {isAuthed && (
          <FanficRail
            title="Новое от подписок"
            subtitle="Свежие главы от авторов, за которыми вы следите"
            fanfics={subsQuery.data ?? []}
            loading={subsQuery.isLoading}
            error={subsQuery.isError}
            seeAllHref="/profile?tab=subscriptions"
          />
        )}

        {/* 5 — Trending (always) */}
        <FanficRail
          title="🔥 Горячее сегодня"
          subtitle="Что читают прямо сейчас"
          fanfics={trendingQuery.data ?? []}
          loading={trendingQuery.isLoading}
          error={trendingQuery.isError}
          seeAllHref="/search"
          emptyLabel="Пусто — попробуйте обновить страницу."
        />

        {/* 6 — For you (auth) OR beginner rail (guests) */}
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
