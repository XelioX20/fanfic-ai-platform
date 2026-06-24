'use client'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Suspense } from 'react'
import { SearchBar } from '@/components/search/SearchBar'
import { FanficGrid } from '@/components/fanfic/FanficGrid'
import { searchApi } from '@/lib/api'

function SearchResults() {
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || ''

  const { data, isLoading } = useQuery({
    queryKey: ['search', query],
    queryFn: () => searchApi.search(query).then((r) => r.data),
    enabled: !!query,
  })

  return (
    <div>
      <SearchBar defaultValue={query} className="max-w-2xl mb-6" />
      {query ? (
        <div>
          {data && (
            <p className="text-zinc-400 text-sm mb-4">
              Найдено {data.total} результатов по запросу «{query}»
            </p>
          )}
          <FanficGrid fanfics={data?.items || []} loading={isLoading} />
        </div>
      ) : (
        <p className="text-zinc-500">Введите запрос для поиска</p>
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
