import { NextRequest, NextResponse } from 'next/server'

const WORKER_URL = process.env.FICBOOK_WORKER_URL || 'https://ficbook-proxy.fanfic-ai-xelio.workers.dev'

export async function POST(req: NextRequest) {
  try {
    const { login, password } = await req.json()
    if (!login || !password) {
      return NextResponse.json({ success: false, error: 'Missing credentials' })
    }

    const body = new URLSearchParams({ login, password, remember: 'true' })
    const res = await fetch(`${WORKER_URL}/login_check`, {
      method: 'POST',
      headers: {
        'User-Agent': 'AppleWebKit/605.1',
        'Content-Type': 'application/x-www-form-urlencoded',
        'authority': 'ficbook.net',
        'origin': 'https://ficbook.net',
        'referer': 'https://ficbook.net/',
      },
      body: body.toString(),
    })

    const setCookieHeader = res.headers.get('x-ficbook-set-cookie') || res.headers.get('set-cookie') || ''
    const data = await res.json()

    if (!data.result) {
      return NextResponse.json({
        success: false,
        error: data.error?.reason || 'Invalid credentials',
      })
    }

    const cookies: Record<string, string> = {}
    for (const part of setCookieHeader.split(',')) {
      const match = part.trim().match(/^(PHPSESSID|rme)=([^;]+)/)
      if (match) cookies[match[1]] = match[2]
    }

    return NextResponse.json({ success: true, cookies, redirect: data.data?.redirect })
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) })
  }
}
