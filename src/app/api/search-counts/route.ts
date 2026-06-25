import { NextRequest, NextResponse } from 'next/server'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

// Cache session cookie — reuse across requests to avoid extra roundtrip
let cachedCookie = ''
let cookieExpires = 0

async function getFicbookSession(): Promise<string> {
  if (cachedCookie && Date.now() < cookieExpires) return cachedCookie

  try {
    const res = await fetch('https://ficbook.net/', {
      headers: { 'User-Agent': UA },
      redirect: 'follow',
    })
    const setCookie = res.headers.get('set-cookie') || ''
    // Extract PHPSESSID
    const match = setCookie.match(/PHPSESSID=([^;]+)/)
    if (match) {
      cachedCookie = `PHPSESSID=${match[1]}`
      cookieExpires = Date.now() + 30 * 60 * 1000 // 30 min
      return cachedCookie
    }
  } catch {}

  return ''
}

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json()
    if (!query?.trim()) {
      return NextResponse.json({ fanfics: 0, requests: 0, users: 0, collections: 0, fandoms: 0 })
    }

    const sessionCookie = await getFicbookSession()
    const body = new URLSearchParams({ query })

    const res = await fetch('https://ficbook.net/get_multi_count', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'User-Agent': UA,
        'Referer': 'https://ficbook.net/',
        'Origin': 'https://ficbook.net',
        ...(sessionCookie ? { 'Cookie': sessionCookie } : {}),
      },
      body: body.toString(),
    })

    if (res.ok) {
      const data = await res.json()
      if (data.result && data.data) {
        return NextResponse.json({
          fanfics: data.data.fanfics ?? 0,
          requests: data.data.requests ?? 0,
          users: data.data.users ?? 0,
          collections: data.data.collections ?? 0,
          fandoms: data.data.fandoms ?? 0,
        })
      }
    }
  } catch (e) {
    console.error('search counts proxy error:', e)
  }

  return NextResponse.json({ fanfics: 0, requests: 0, users: 0, collections: 0, fandoms: 0 })
}
