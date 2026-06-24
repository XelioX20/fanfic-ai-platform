import { SearchBar } from '@/components/search/SearchBar'
import { RecommendationSection } from '@/components/recommendations/RecommendationSection'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-950">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <header className="mb-10">
          <h1 className="text-3xl font-bold text-zinc-100 mb-2">
            Fanfic AI Platform
          </h1>
          <p className="text-zinc-400 mb-6">
            AI-powered рекомендации фанфиков с ficbook.net
          </p>
          <SearchBar className="max-w-2xl" />
        </header>

        <div className="space-y-10">
          <RecommendationSection title="🔥 Трендовое" type="trending" />
          <RecommendationSection title="✨ Для вас" type="for-me" />
        </div>
      </div>
    </main>
  )
}
