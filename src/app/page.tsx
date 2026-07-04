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
// Home rails go through the Next.js API proxy at /api/ficbook/list which fronts
// the Cloudflare Worker. The FastAPI backend does NOT expose /search/list,
// /profile/*, /recommendations/for-me, or /fanfics/{id}/full — those endpoints
// belong to a later milestone (see docs/ux-synthesis-2026-07-04.md). Until then
// we serve the home page from public ficbook.net data, which needs no auth and
// covers 90% of the value.
//
// The proxy accepts these path values:
//   'popular-fanfics-376846'        — trending (default)
//   'popular-fanfics-376846/het'    — het
//   'popular-fanfics-376846/slash-fics-ngf3487tnsfb' — slash
//   'popular-fanfics-376846/gen'    — gen

const RAIL_PATH_TRENDING = 'popular-fanfics-376846'
const RAIL_PATH_SLASH    = 'popular-fanfics-376846/slash-fics-ngf3487tnsfb'
const RAIL_PATH_GEN      = 'popular-fanfics-376846/gen'

async function fetchList(path: string): Promise<Fanfic[]> {
  const res = await fetch(`/api/ficbook/list?path=${encodeURIComponent(path)}&p=1`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return (data.items ?? []) as Fanfic[]
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

  // -------- Continue Reading --------
  // We don't have a /fanfics/{id}/full endpoint on the backend yet, so the hero
  // only shows what we can derive from the reader store (the fanficId + chapter).
  // The card component tolerates a null fanfic and renders a lean resume CTA.
  const primaryFic: Fanfic | null = null

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
    queryFn: () => fetchList(RAIL_PATH_GEN),
    staleTime: 10 * 60 * 1000,
    retry: 1,
    enabled: isGuest,
  })

  // -------- Derived: continue-reading chapter meta --------
  // Without /full we can only surface the raw chapter id — no chapter title or
  // total-count until the endpoint lands. Percent is a rough heuristic based on
  // scrollY only; a real percent needs scrollHeight persisted alongside.
  const chapterMeta = useMemo(() => {
    if (!primaryEntry) return { title: undefined, index: undefined, total: undefined }
    if (primaryEntry.chapterId === 'single') {
      return { title: undefined, index: 1, total: 1 }
    }
    return { title: undefined, index: undefined, total: undefined }
  }, [primaryEntry])

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
            fanfic={primaryFic}
            loading={false}
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

        {/* 4 — Trending (always) */}
        <FanficRail
          title="🔥 Горячее сегодня"
          subtitle="Что читают прямо сейчас"
          fanfics={trendingQuery.data ?? []}
          loading={trendingQuery.isLoading}
          error={trendingQuery.isError}
          seeAllHref="/search"
          emptyLabel="Пусто — попробуйте обновить страницу."
        />

        {/* 5 — Beginner rail for guests */}
        {isGuest && (
          <FanficRail
            title="👋 С чего начать"
            subtitle="Хорошие входные точки, если вы здесь впервые"
            fanfics={(beginnerQuery.data ?? []).slice(0, 8)}
            loading={beginnerQuery.isLoading}
            error={beginnerQuery.isError}
            skeletonCount={8}
          />
        )}

        {/* 6 — Editorial: Hidden gems */}
        <EditorialCollection
          title="Скрытые жемчужины"
          fanfics={gemsQuery.data ?? []}
          loading={gemsQuery.isLoading}
        />

        {/* 7 — Fandom shortcuts */}
        <FandomStrip />

        {/* 8 — Footer nudge */}
        <FooterActions isGuest={isGuest} />
      </div>
    </main>
  )
}
