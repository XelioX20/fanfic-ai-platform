import { NextRequest, NextResponse } from 'next/server'

const UA = 'AppleWebKit/605.1'
const FICBOOK = 'https://ficbook.net'
const SEARCH_PATH = 'find-fanfics-846555'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const q = searchParams.get('q') || ''
  const page = searchParams.get('p') || '1'

  if (!q.trim()) {
    return NextResponse.json({ items: [], has_next: false, page: 1 })
  }

  try {
    const url = `${FICBOOK}/${SEARCH_PATH}?title=${encodeURIComponent(q)}&p=${page}`
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9',
        'Referer': `${FICBOOK}/`,
      },
      redirect: 'follow',
    })

    if (!res.ok) {
      return NextResponse.json({ error: `ficbook returned ${res.status}`, items: [], has_next: false })
    }

    const html = await res.text()
    const items = parseFanficCards(html)
    const has_next = html.includes('class="next"') && !html.includes('class="next disabled"')

    return NextResponse.json({ items, has_next, page: parseInt(page), query: q })
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

  const href = hrefMatch ? hrefMatch[1] : ''
  const id = idMatch ? idMatch[1] : (href.match(/\/(\d+)$/) || [])[1] || ''

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
    cover_url: (article.match(/fanfic-main-cover[^>]*src="([^"]+)"/) || [])[1] || null,
    ficbook_url: href ? `https://ficbook.net${href}` : '',
    fandoms: [], pairings: [], tags: [],
    words_count: 0, chapters_count: 0, comments_count: 0,
    description: '',
  }
}
