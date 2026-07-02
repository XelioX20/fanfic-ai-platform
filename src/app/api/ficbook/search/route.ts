import { NextRequest, NextResponse } from 'next/server'

const WORKER_URL = process.env.FICBOOK_WORKER_URL || 'https://ficbook-proxy.fanfic-ai-xelio.workers.dev'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const q = searchParams.get('q') || ''
  const page = searchParams.get('p') || '1'

  if (!q.trim()) {
    return NextResponse.json({ items: [], has_next: false, page: 1 })
  }

  try {
    const path = `find-fanfics-846555?title=${encodeURIComponent(q)}&p=${page}`
    const res = await fetch(`${WORKER_URL}/${path}`, {
      headers: { 'User-Agent': 'AppleWebKit/605.1' },
      redirect: 'follow',
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Worker returned ${res.status}`, items: [], has_next: false })
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
  const href = hrefMatch ? hrefMatch[1] : ''
  const uuidMatch = href.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
  const id = uuidMatch ? uuidMatch[1] : (idMatch ? idMatch[1] : '')
  return {
    id, title: titleMatch ? titleMatch[1].trim() : '', href,
    author_name: authorMatch ? authorMatch[2].trim() : '',
    author_id: authorMatch ? (authorMatch[1].match(/\/(\d+)/) || [])[1] || '' : '',
    direction: 'Неизвестно', rating: 'Неизвестно', completion_status: 'Неизвестно',
    is_hot: false, likes: 0, trophies: 0, cover_url: null,
    ficbook_url: href ? `https://ficbook.net${href}` : '',
    fandoms: [], pairings: [], tags: [], words_count: 0, chapters_count: 0, comments_count: 0,
    description: '',
  }
}
