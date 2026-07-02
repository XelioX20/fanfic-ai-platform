import { NextRequest, NextResponse } from 'next/server'

const FICBOOK = 'https://ficbook.net'
const UA = 'AppleWebKit/605.1'

export async function POST(req: NextRequest) {
  try {
    const { login, password } = await req.json()
    if (!login || !password) {
      return NextResponse.json({ success: false, error: 'Missing credentials' })
    }

    const body = new URLSearchParams({ login, password, remember: 'true' })
    const res = await fetch(`${FICBOOK}/login_check`, {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        'authority': 'ficbook.net',
        'origin': 'https://ficbook.net',
        'referer': 'https://ficbook.net/',
      },
      body: body.toString(),
    })

    const data = await res.json()

    if (!data.result) {
      return NextResponse.json({
        success: false,
        error: data.error?.reason || 'Invalid credentials',
      })
    }

    // Extract PHPSESSID and rme from Set-Cookie
    const cookies: Record<string, string> = {}
    const setCookie = res.headers.get('set-cookie') || ''
    for (const part of setCookie.split(',')) {
      const match = part.trim().match(/^(PHPSESSID|rme)=([^;]+)/)
      if (match) cookies[match[1]] = match[2]
    }

    return NextResponse.json({ success: true, cookies, redirect: data.data?.redirect })
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) })
  }
}
