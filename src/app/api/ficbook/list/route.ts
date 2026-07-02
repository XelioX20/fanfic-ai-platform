import { NextRequest, NextResponse } from 'next/server'

const UA = 'AppleWebKit/605.1'
const FICBOOK = 'https://ficbook.net'

// Cache parsed results briefly to reduce ficbook hits
const cache = new Map<string, { data: unknown; expires: number }>()

// Map section types to /fanfiction query params that work with static HTML
const SECTION_PARAMS: Record<string, Record<string, string>> = {
  'popular-fanfics-376846': {},
  'popular-fanfics-376846/het': { direction: 'het' },
  'popular-fanfics-376846/slash-fics-ngf3487tnsfb': { direction: 'slash' },
  'popular-fanfics-376846/gen': { direction: 'gen' },
  'popular-fanfics-376846/femslash-fanfics-kojhi9jhhmkhgi9t98': { direction: 'femslash' },
  'home/favourites': { type: 'favourites' },  // requires auth cookie
  'home/liked_fanfics': { type: 'liked' },
  'home/readedList': { type: 'readed' },
  'home/followList': { type: 'follow' },
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const path = searchParams.get('path') || 'popular-fanfics-376846'
  const page = searchParams.get('p') || '1'
  const cookie = searchParams.get('cookie') || ''

  const cacheKey = `${path}::${page}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() < cached.expires) {
    return NextResponse.json(cached.data)
  }

  try {
    // Map obfuscated paths to /fanfiction which returns static HTML
    // Only /fanfiction works — popular-fanfics-376846 and category subpaths are Vue-rendered
    let url: string
    const extraParams = SECTION_PARAMS[path]
    if (extraParams !== undefined && !path.startsWith('home/')) {
      const qs = new URLSearchParams({ ...extraParams, p: page })
      url = `${FICBOOK}/fanfiction?${qs}`
    } else {
      url = `${FICBOOK}/${path}?p=${page}`
    }

    const headers: Record<string, string> = {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
      'Accept-Language': 'ru-RU,ru;q=0.9',
      'Referer': `${FICBOOK}/`,
    }
    if (cookie) headers['Cookie'] = cookie

    const res = await fetch(url, { headers, redirect: 'follow' })
    if (!res.ok) {
      return NextResponse.json({ error: `ficbook returned ${res.status}`, items: [], has_next: false }, { status: 200 })
    }
    const html = await res.text()

    // Parse fanfic cards from HTML
    const items = parseFanficCards(html)
    const has_next = html.includes('class="next"') && !html.includes('class="next disabled"')

    const result = { items, has_next, page: parseInt(page) }
    // Cache public pages for 5 minutes, personal pages (with cookie) for 2 minutes
    cache.set(cacheKey, { data: result, expires: Date.now() + (cookie ? 120_000 : 300_000) })

    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: String(e), items: [], has_next: false }, { status: 200 })
  }
}

function parseFanficCards(html: string) {
  const items: unknown[] = []
  // Extract fanfic-inline articles using regex (no DOM parser in Node edge runtime)
  const articleRegex = /<article[^>]*fanfic-inline[^>]*>([\s\S]*?)<\/article>/g
  let match
  while ((match = articleRegex.exec(html)) !== null) {
    const article = match[0]
    const item = parseCard(article)
    if (item.id) items.push(item)
  }
  return items
}

function extractAttr(html: string, pattern: RegExp): string {
  const m = html.match(pattern)
  return m ? m[1] : ''
}

function extractText(html: string, pattern: RegExp): string {
  const m = html.match(pattern)
  if (!m) return ''
  return m[1].replace(/<[^>]+>/g, '').trim()
}

function parseCard(article: string) {
  // ID from fanfic-more-dropdown :fanfic-id
  const id = extractAttr(article, /fanfic-id="(\d+)"/)
  // href from visit-link
  const href = extractAttr(article, /class="visit-link"[^>]*href="([^"]+)"/)
  // title
  const title = extractText(article, /class="visit-link"[^>]*>([^<]+)</)
  // author
  const authorMatch = article.match(/class="word-break urlize"[^>]*href="([^"]+)"[^>]*>([^<]+)</)
  const authorName = authorMatch ? authorMatch[2].trim() : ''
  const authorId = authorMatch ? (authorMatch[1].match(/\/(\d+)/) || [])[1] || '' : ''
  // direction, rating, status
  const direction = extractText(article, /class="[^"]*direction[^"]*"[^>]*>[\s\S]*?<span[^>]*>([^<]+)</)
  const rating = extractText(article, /class="[^"]*badge-rating[^"]*"[^>]*>\s*([A-Z0-9-]+)\s*</)
  const status = extractText(article, /class="[^"]*status[^"]*"[^>]*>[\s\S]*?<span[^>]*>([^<]+)</)
  const isHot = article.includes('fanfic-hat-premium-notice') || article.includes('hot-fanfic')
  // likes
  const likesMatch = article.match(/badge-like[^>]*>[\s\S]*?<span[^>]*>(\d+)</)
  const likes = likesMatch ? parseInt(likesMatch[1]) : 0
  // cover
  const coverMatch = article.match(/class="[^"]*fanfic-main-cover[^"]*"[^>]*src="([^"]+)"/)
  const coverUrl = coverMatch ? coverMatch[1] : null

  const ficbookUrl = href ? `https://ficbook.net${href.split('?')[0]}` : ''

  return {
    id: id || extractAttr(article, /\/readfic\/([\w-]+)/),
    title, href,
    author_name: authorName,
    author_id: authorId,
    direction: direction || 'Неизвестно',
    rating: rating || 'Неизвестно',
    completion_status: status || 'Неизвестно',
    is_hot: isHot,
    likes, trophies: 0,
    cover_url: coverUrl,
    ficbook_url: ficbookUrl,
    fandoms: [], pairings: [], tags: [],
    words_count: 0, chapters_count: 0, comments_count: 0,
    description: '',
  }
}
