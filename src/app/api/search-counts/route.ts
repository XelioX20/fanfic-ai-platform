import { NextRequest, NextResponse } from 'next/server'

const WORKER_URL = process.env.FICBOOK_WORKER_URL || 'https://ficbook-proxy.fanfic-ai-xelio.workers.dev'

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json().catch(() => ({}))
    if (!query?.trim()) {
      return NextResponse.json({ fanfics: 0, requests: 0, users: 0, collections: 0, fandoms: 0 })
    }

    const body = new URLSearchParams({ query })
    const res = await fetch(`${WORKER_URL}/get_multi_count`, {
      method: 'POST',
      headers: {
        'User-Agent': 'AppleWebKit/605.1',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, */*',
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
    console.error('search counts error:', e)
  }
  return NextResponse.json({ fanfics: 0, requests: 0, users: 0, collections: 0, fandoms: 0 })
}
