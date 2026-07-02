import { NextRequest, NextResponse } from 'next/server'

const WORKER_URL = process.env.FICBOOK_WORKER_URL || 'https://ficbook-proxy.fanfic-ai-xelio.workers.dev'

const cache = new Map<string, { data: unknown; expires: number }>()

// Map section types to query params for /fanfiction endpoint
const SECTION_QUERY: Record<string, string> = {
  'popular-fanfics-376846': '',
  'popular-fanfics-376846/het': 'direction=het',
  'popular-fanfics-376846/slash-fics-ngf3487tnsfb': 'direction=slash',
  'popular-fanfics-376846/gen': 'direction=gen',
  'popular-fanfics-376846/femslash-fanfics-kojhi9jhhmkhgi9t98': 'direction=femslash',
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const path = searchParams.get('path') || 'popular-fanfics-376846'
  const page = searchParams.get('p') || '1'
  const cookie = searchParams.get('cookie') || ''

  const cacheKey = `${path}::${page}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() < cached.expires && !cookie) {
    return NextResponse.json(cached.data)
  }

  try {
    // Route through Cloudflare Worker
    let workerPath: string
    const sectionQuery = SECTION_QUERY[path]
    if (sectionQuery !== undefined) {
      // Use /fanfiction with direction param (only path returning static HTML)
      workerPath = sectionQuery
        ? `fanfiction?${sectionQuery}&p=${page}`
        : `fanfiction?p=${page}`
    } else {
      // Personal sections (home/favourites, etc.) — pass through with cookies
      workerPath = `${path}?p=${page}`
    }

    const headers: Record<string, string> = {
      'User-Agent': 'AppleWebKit/605.1',
    }
    if (cookie) headers['x-ficbook-cookie'] = cookie

    const res = await fetch(`${WORKER_URL}/${workerPath}`, { headers, redirect: 'follow' })
    const html = await res.text()

    if (!res.ok) {
      return NextResponse.json({ error: `Worker returned ${res.status}`, items: [], has_next: false })
    }

    const items = parseFanficCards(html)
    const has_next = html.includes('class="next"') && !html.includes('class="next disabled"')

    const result = { items, has_next, page: parseInt(page) }
    if (!cookie) cache.set(cacheKey, { data: result, expires: Date.now() + 300_000 })

    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: String(e), items: [], has_next: false })
  }
}

function parseFanficCards(html: string) {
  const items: unknown[] = []
  const articleRegex = /<article[^>]*fanfic-inline[^>]*>([\s\S]*?)<\/article>/g
  let match
  while ((match = articleRegex.exec(html)) !== null) {
    const item = parseCard(match[0])
    if (item.id) items.push(item)
  }
  return items
}

function parseCard(article: string) {
  const idMatch = article.match(/fanfic-id="(\d+)"/)
  const hrefMatch = article.match(/class="visit-link"[^>]*href="([^"?]+)/)
  const titleMatch = article.match(/class="visit-link"[^>]*>([^<]+)</)
  const authorMatch = article.match(/class="word-break urlize"[^>]*href="([^"]+)"[^>]*>([^<]+)</)
  const likesMatch = article.match(/badge-like[\s\S]*?(\d+)/)
  const coverMatch = article.match(/fanfic-hat-cover-picture[\s\S]*?src="([^"]+)"/)

  const href = hrefMatch ? hrefMatch[1] : ''
  // Extract UUID from href (ficbook now uses UUIDs like 019efa9f-ccf8-...)
  // Numeric IDs (16501704) are old format that no longer work on ficbook.net
  const uuidMatch = href.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
  const id = uuidMatch ? uuidMatch[1] : (idMatch ? idMatch[1] : '')

  return {
    id,
    title: titleMatch ? titleMatch[1].trim() : '',
    href,
    author_name: authorMatch ? authorMatch[2].trim() : '',
    author_id: authorMatch ? (authorMatch[1].match(/\/(\d+)/) || [])[1] || '' : '',
    direction: 'Неизвестно',
    rating: 'Неизвестно',
    completion_status: 'Неизвестно',
    is_hot: article.includes('hot-fanfic') || article.includes('premium-notice'),
    likes: likesMatch ? parseInt(likesMatch[1]) : 0,
    trophies: 0,
    cover_url: coverMatch ? coverMatch[1] : null,
    ficbook_url: href ? `https://ficbook.net${href}` : '',
    fandoms: [], pairings: [], tags: [],
    words_count: 0, chapters_count: 0, comments_count: 0,
    description: '',
  }
}
