import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  // Count endpoint proxies to backend which uses ScrapingAnt
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  try {
    const { query } = await req.json().catch(() => ({}))
    if (!query?.trim()) {
      return NextResponse.json({ fanfics: 0, requests: 0, users: 0, collections: 0, fandoms: 0 })
    }
    const res = await fetch(`${API_URL}/api/v1/search/counts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    if (res.ok) return NextResponse.json(await res.json())
  } catch {}
  return NextResponse.json({ fanfics: 0, requests: 0, users: 0, collections: 0, fandoms: 0 })
}
