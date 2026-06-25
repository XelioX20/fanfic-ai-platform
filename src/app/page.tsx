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
          <div className="mt-4">
            <a
              href="/discover"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-zinc-900 border border-zinc-700 hover:border-purple-600/60 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg text-sm transition-all group"
            >
              <span className="text-lg">🎲</span>
              <span>Не знаю что почитать — помоги выбрать</span>
              <span className="text-zinc-600 group-hover:text-zinc-400 transition-colors">→</span>
            </a>
          </div>
        </header>

        <div className="space-y-10">
          <RecommendationSection title="🔥 Трендовое" type="trending" />
          <RecommendationSection title="✨ Для вас" type="for-me" />
        </div>
      </div>
    </main>
  )
}
