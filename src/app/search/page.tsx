'use client'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Suspense } from 'react'
import { SearchBar } from '@/components/search/SearchBar'
import { FanficGrid } from '@/components/fanfic/FanficGrid'

function SearchResults() {
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || ''

  const { data, isLoading, error } = useQuery({
    queryKey: ['search-proxy', query],
    queryFn: async () => {
      if (!query.trim()) return { items: [], has_next: false }
      // Use Next.js proxy route — Vercel IP not blocked by ficbook
      const res = await fetch(`/api/ficbook/search?q=${encodeURIComponent(query)}&p=1`)
      return res.json()
    },
    enabled: !!query,
    retry: 1,
  })

  if (!query) {
    return <p className="text-zinc-500">Введите запрос для поиска</p>
  }

  return (
    <div>
      <SearchBar defaultValue={query} className="max-w-2xl mb-6" />
      {error ? (
        <div className="py-8 text-center">
          <p className="text-red-400 text-sm mb-2">Не удалось выполнить поиск</p>
          <p className="text-zinc-600 text-xs">Попробуй ещё раз</p>
        </div>
      ) : (
        <div>
          {!isLoading && data?.items?.length > 0 && (
            <p className="text-zinc-400 text-sm mb-4">
              Результаты по запросу «{query}»
            </p>
          )}
          <FanficGrid fanfics={data?.items ?? []} loading={isLoading} />
          {!isLoading && data?.items?.length === 0 && (
            <p className="text-zinc-500 text-center py-12">По запросу «{query}» ничего не найдено</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function SearchPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-zinc-100 mb-6">Поиск</h1>
      <Suspense fallback={<div className="text-zinc-500">Загрузка...</div>}>
        <SearchResults />
      </Suspense>
    </main>
  )
}
