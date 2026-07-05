/**
 * Cloudflare Worker — ficbook.net proxy
 * Runs inside Cloudflare network, so ficbook's Cloudflare protection doesn't block it.
 * Free plan: 100,000 requests/day, no cold starts.
 *
 * ─── Cache layer ────────────────────────────────────────────────────────
 * GET requests for public (cookie-less) paths are cached in the edge PoP's
 * `caches.default` for 10 minutes. This means:
 *   - Every visitor after the first in a given region hits the edge cache
 *     (~5-20 ms) instead of round-tripping to ficbook.net (200-2000 ms).
 *   - Our Render backend doesn't scrape ficbook every time it needs the
 *     same HTML — the Worker serves stale-but-recent within the TTL.
 *   - Zero cost: `caches.default` on Cloudflare's edge is free, unlimited
 *     writes, no request-count charges.
 * Requests carrying `x-ficbook-cookie` (authenticated section reads) or
 * non-GET requests bypass the cache entirely so personalised/adult content
 * and POSTs never leak or get cached.
 */

const FICBOOK = 'https://ficbook.net'
const UA = 'AppleWebKit/605.1'

// Cache TTL for successful public GET responses. 10 min = fresh enough for
// listing pages that change slowly, short enough that a newly published
// chapter shows up on the next tick.
const CACHE_TTL_S = 600

// Allowed path prefixes to prevent open proxy abuse
const ALLOWED_PREFIXES = [
  '/fanfiction',
  '/find-fanfics-846555',
  '/readfic/',
  '/authors/',
  '/home/favourites',
  '/home/liked_fanfics',
  '/home/readedList',
  '/home/followList',
  '/home/visitedList',
  '/home/settings',
  '/login_check',
  '/get_multi_count',
  '/fandoms/search',
  '/tags/search',
  '/authors/search',
  '/ajax/fandoms/characters',
  '/ajax/fanfic_actions_state',
  '/collections/',
  '/fanfic_download/',
]

export default {
  async fetch(request: Request, env: unknown, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(),
      })
    }

    // Health check
    if (url.pathname === '/health') {
      return jsonResponse({ ok: true, service: 'ficbook-proxy' })
    }

    // Extract target path from ?path= or from pathname directly
    let targetPath = url.searchParams.get('path') || url.pathname
    const targetQuery = url.searchParams.get('qs') || ''

    // Strip /proxy prefix if used
    if (targetPath.startsWith('/proxy')) {
      targetPath = targetPath.slice(6)
    }

    // Security: only allow known ficbook paths
    const normalizedPath = targetPath.startsWith('/') ? targetPath : '/' + targetPath
    const isAllowed = ALLOWED_PREFIXES.some(p => normalizedPath.startsWith(p))
    if (!isAllowed) {
      return jsonResponse({ error: 'Path not allowed', path: targetPath }, 403)
    }

    // Build target URL using normalized path
    const ficbookUrl = new URL(FICBOOK + normalizedPath)
    // Forward all query params except 'path' and 'qs'
    for (const [k, v] of url.searchParams.entries()) {
      if (k !== 'path' && k !== 'qs') {
        ficbookUrl.searchParams.set(k, v)
      }
    }
    if (targetQuery) {
      const extra = new URLSearchParams(targetQuery)
      for (const [k, v] of extra.entries()) {
        ficbookUrl.searchParams.set(k, v)
      }
    }

    // Forward cookies from the request (for authenticated sections)
    const forwardedCookie = request.headers.get('x-ficbook-cookie') || ''

    // Cache check — only for public GETs without a cookie.
    // Cache key uses the fully-resolved ficbookUrl so all query params
    // participate in the key.
    const cacheable = request.method === 'GET' && !forwardedCookie
    const cache = caches.default
    const cacheKey = new Request(ficbookUrl.toString(), { method: 'GET' })
    if (cacheable) {
      const hit = await cache.match(cacheKey)
      if (hit) {
        // Re-wrap so we can set our own CORS + X-Cache headers on top of
        // whatever Cloudflare stored.
        const headers = new Headers(hit.headers)
        for (const [k, v] of Object.entries(corsHeaders())) headers.set(k, v)
        headers.set('X-Cache', 'HIT')
        return new Response(hit.body, { status: hit.status, headers })
      }
    }

    // Build headers for ficbook request
    const ficbookHeaders: Record<string, string> = {
      'User-Agent': UA,
      'Accept': request.headers.get('Accept') || 'text/html,application/xhtml+xml,*/*;q=0.8',
      'Accept-Language': 'ru-RU,ru;q=0.9',
      'Referer': FICBOOK + '/',
    }
    if (forwardedCookie) {
      ficbookHeaders['Cookie'] = forwardedCookie
    }
    if (request.method === 'POST') {
      ficbookHeaders['Content-Type'] = request.headers.get('Content-Type') || 'application/x-www-form-urlencoded'
      ficbookHeaders['authority'] = 'ficbook.net'
      ficbookHeaders['origin'] = FICBOOK
    }

    try {
      const ficbookResp = await fetch(ficbookUrl.toString(), {
        method: request.method,
        headers: ficbookHeaders,
        body: request.method === 'POST' ? request.body : undefined,
        redirect: 'follow',
      })

      // Return response with CORS headers
      const respHeaders = new Headers(corsHeaders())
      respHeaders.set('Content-Type', ficbookResp.headers.get('Content-Type') || 'text/html; charset=utf-8')
      respHeaders.set('x-ficbook-status', String(ficbookResp.status))
      respHeaders.set('X-Cache', 'MISS')

      // Forward set-cookie for auth
      const setCookie = ficbookResp.headers.get('set-cookie')
      if (setCookie) {
        respHeaders.set('x-ficbook-set-cookie', setCookie)
      }

      // Read the body once so we can both return it AND cache it.
      // `Response.clone()` would work but arrayBuffer is simpler here.
      const bodyBuffer = await ficbookResp.arrayBuffer()

      // Store in edge cache if the response is cacheable + successful.
      // Only 2xx bodies get cached — 4xx/5xx would poison the cache.
      if (cacheable && ficbookResp.ok) {
        const cacheHeaders = new Headers()
        cacheHeaders.set('Content-Type', respHeaders.get('Content-Type')!)
        cacheHeaders.set('Cache-Control', `public, s-maxage=${CACHE_TTL_S}, max-age=${CACHE_TTL_S}`)
        const cacheable_resp = new Response(bodyBuffer, {
          status: 200,
          headers: cacheHeaders,
        })
        // Use ctx.waitUntil so caching doesn't block the response.
        ctx.waitUntil(cache.put(cacheKey, cacheable_resp))
      }

      return new Response(bodyBuffer, {
        status: ficbookResp.ok ? 200 : ficbookResp.status,
        headers: respHeaders,
      })
    } catch (e) {
      return jsonResponse({ error: String(e) }, 502)
    }
  },
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-ficbook-cookie',
    'Access-Control-Expose-Headers': 'x-ficbook-status, x-ficbook-set-cookie, X-Cache',
  }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  })
}
