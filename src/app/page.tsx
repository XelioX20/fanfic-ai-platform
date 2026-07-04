import { RecommendationSection } from '@/components/recommendations/RecommendationSection'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-950">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <header className="mb-8 md:mb-10">
          {/* Compact greeting — no duplicate search */}
          <h1 className="text-2xl md:text-4xl font-bold text-zinc-100 mb-1.5 tracking-tight">
            Что почитаем сегодня?
          </h1>
          <p className="text-sm md:text-base text-zinc-400 mb-5">
            AI-подборки фанфиков с ficbook.net — под ваше настроение
          </p>

          {/* Primary action: quiz CTA (preserved, promoted to hero anchor) */}
          <a
            href="/discover"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600/20 to-purple-600/10 border border-purple-600/40 hover:border-purple-500 hover:from-purple-600/30 text-zinc-100 rounded-lg text-sm font-medium transition-all group"
          >
            <span className="text-lg">🎲</span>
            <span>Не знаю что почитать — помоги выбрать</span>
            <span className="text-purple-400 group-hover:translate-x-0.5 transition-transform">→</span>
          </a>

          {/* Secondary: mood/genre quick-filter chips */}
          <div className="mt-5 flex flex-wrap gap-2">
            {[
              { label: "Романтика", q: "романтика" },
              { label: "Ангст", q: "ангст" },
              { label: "Флафф", q: "флафф" },
              { label: "Приключения", q: "приключения" },
              { label: "AU", q: "AU" },
              { label: "Слоуберн", q: "слоуберн" },
            ].map((c) => (
              <a
                key={c.q}
                href={`/search?q=${encodeURIComponent(c.q)}`}
                className="px-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-full transition-colors"
              >
                {c.label}
              </a>
            ))}
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
