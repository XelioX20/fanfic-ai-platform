'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, RotateCcw, Loader2, Sparkles } from 'lucide-react'
import { FanficGrid } from '@/components/fanfic/FanficGrid'
import { cn } from '@/lib/utils'
import type { Fanfic } from '@/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface Answers {
  direction: string
  mood: string
  size: string
  status: string
  category: string
}

interface StepOption {
  value: string
  label: string
  emoji: string
  description?: string
}

const STEPS = [
  {
    id: 'direction',
    question: 'Какое направление тебе нравится?',
    subtitle: 'Определяет тип отношений между персонажами',
    options: [
      { value: 'slash', label: 'Слэш', emoji: '💙', description: 'М/М' },
      { value: 'het', label: 'Гет', emoji: '🩷', description: 'М/Ж' },
      { value: 'gen', label: 'Джен', emoji: '🌿', description: 'Без романтики' },
      { value: 'femslash', label: 'Фемслэш', emoji: '💜', description: 'Ж/Ж' },
      { value: '', label: 'Любое', emoji: '✨', description: 'Не важно' },
    ] as StepOption[],
  },
  {
    id: 'mood',
    question: 'Какое настроение хочется?',
    subtitle: 'Выбери эмоциональный тон истории',
    options: [
      { value: 'angst', label: 'Ангст', emoji: '💔', description: 'Боль и страдания' },
      { value: 'fluff', label: 'Флафф', emoji: '🌸', description: 'Мило и тепло' },
      { value: 'romance', label: 'Романтика', emoji: '❤️', description: 'Любовная история' },
      { value: 'drama', label: 'Драма', emoji: '🎭', description: 'Напряжение и конфликты' },
      { value: 'adventure', label: 'Приключения', emoji: '⚔️', description: 'Экшн и события' },
      { value: 'humor', label: 'Юмор', emoji: '😄', description: 'Смешно и легко' },
      { value: '', label: 'Сюрприз', emoji: '🎲', description: 'Что угодно' },
    ] as StepOption[],
  },
  {
    id: 'size',
    question: 'Сколько времени готов читать?',
    subtitle: 'Объём фанфика',
    options: [
      { value: 'short', label: 'Быстро', emoji: '📖', description: 'До 50 тыс. слов' },
      { value: 'medium', label: 'В самый раз', emoji: '📚', description: '50–200 тыс. слов' },
      { value: 'long', label: 'Надолго', emoji: '📕', description: 'Более 200 тыс. слов' },
      { value: '', label: 'Неважно', emoji: '🔀', description: 'Любой объём' },
    ] as StepOption[],
  },
  {
    id: 'status',
    question: 'Предпочитаешь законченные истории?',
    subtitle: 'Статус публикации',
    options: [
      { value: 'complete', label: 'Завершён', emoji: '✅', description: 'Хочу дочитать до конца' },
      { value: 'in_progress', label: 'В процессе', emoji: '⟳', description: 'Ждать продолжение' },
      { value: '', label: 'Неважно', emoji: '🔀', description: 'Любой статус' },
    ] as StepOption[],
  },
  {
    id: 'category',
    question: 'Из какой вселенной?',
    subtitle: 'Категория или фэндом',
    options: [
      { value: 'anime', label: 'Аниме', emoji: '🎌', description: 'Аниме и манга' },
      { value: 'books', label: 'Книги', emoji: '📖', description: 'Литература' },
      { value: 'games', label: 'Игры', emoji: '🎮', description: 'Видеоигры' },
      { value: 'movies', label: 'Кино', emoji: '🎬', description: 'Фильмы' },
      { value: 'series', label: 'Сериалы', emoji: '📺', description: 'ТВ-шоу' },
      { value: 'kpop', label: 'K-pop', emoji: '🎤', description: 'K-pop / RPF' },
      { value: '', label: 'Любой', emoji: '🌍', description: 'Любой фэндом' },
    ] as StepOption[],
  },
]

const TOTAL_STEPS = STEPS.length

function ProgressBar({ current }: { current: number }) {
  return (
    <div className="flex gap-1.5 mb-8">
      {STEPS.map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1 flex-1 rounded-full transition-all duration-300',
            i < current ? 'bg-purple-500' : i === current ? 'bg-purple-400' : 'bg-zinc-800'
          )}
        />
      ))}
    </div>
  )
}

export default function DiscoverPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Answers>({ direction: '', mood: '', size: '', status: '', category: '' })
  const [results, setResults] = useState<Fanfic[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [ficbookUrl, setFicbookUrl] = useState('')

  const currentStep = STEPS[step]

  const handleAnswer = async (fieldValue: string) => {
    const field = currentStep.id as keyof Answers
    const newAnswers = { ...answers, [field]: fieldValue }
    setAnswers(newAnswers)

    if (step < TOTAL_STEPS - 1) {
      setStep(s => s + 1)
    } else {
      // Last step — fetch results
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        if (newAnswers.direction) params.set('direction', newAnswers.direction)
        if (newAnswers.mood) params.set('mood', newAnswers.mood)
        if (newAnswers.size) params.set('size', newAnswers.size)
        if (newAnswers.status) params.set('status', newAnswers.status)
        if (newAnswers.category) params.set('category', newAnswers.category)

        const res = await fetch(`${API_URL}/api/v1/discover/discover?${params.toString()}`)
        const data = await res.json()
        setResults(data.items || [])
        setFicbookUrl(data.ficbook_url || '')
        setShowResults(true)
      } catch (e) {
        setError('Не удалось загрузить результаты. Попробуй ещё раз.')
      } finally {
        setLoading(false)
      }
    }
  }

  const reset = () => {
    setStep(0)
    setAnswers({ direction: '', mood: '', size: '', status: '', category: '' })
    setResults([])
    setShowResults(false)
    setError(null)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 flex items-center justify-center flex-col gap-4">
        <div className="w-12 h-12 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-400 text-sm">Подбираем фанфики под твои предпочтения…</p>
      </main>
    )
  }

  if (showResults) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
              <Sparkles size={20} className="text-purple-400" />
              Подобрали для тебя
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              {results.length > 0 ? `Найдено ${results.length} фанфиков` : 'По твоим критериям'}
            </p>
          </div>
          <button
            onClick={reset}
            className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-500 rounded-lg transition-colors"
          >
            <RotateCcw size={14} /> Заново
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-950/30 border border-red-800/40 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {results.length === 0 && !error ? (
          <div className="text-center py-16">
            <p className="text-zinc-500 mb-4">По таким параметрам ничего не нашлось</p>
            <button onClick={reset} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors">
              Попробовать другие параметры
            </button>
          </div>
        ) : (
          <FanficGrid fanfics={results} />
        )}
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-zinc-950">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Back button */}
        <button
          onClick={() => step > 0 ? setStep(s => s - 1) : router.push('/')}
          className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 mb-6 transition-colors text-sm"
        >
          <ArrowLeft size={14} />
          {step > 0 ? 'Назад' : 'На главную'}
        </button>

        {/* Progress */}
        <ProgressBar current={step} />

        {/* Step counter */}
        <p className="text-xs text-zinc-600 mb-3">{step + 1} / {TOTAL_STEPS}</p>

        {/* Question */}
        <h1 className="text-2xl font-bold text-zinc-100 mb-2">{currentStep.question}</h1>
        <p className="text-zinc-500 text-sm mb-8">{currentStep.subtitle}</p>

        {/* Options grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {currentStep.options.map((option) => (
            <button
              key={option.value || 'any'}
              onClick={() => handleAnswer(option.value)}
              className="group flex flex-col items-center gap-2 p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-purple-600/60 hover:bg-zinc-800/80 active:scale-95 transition-all text-center"
            >
              <span className="text-3xl">{option.emoji}</span>
              <span className="font-medium text-zinc-200 text-sm group-hover:text-white transition-colors">
                {option.label}
              </span>
              {option.description && (
                <span className="text-xs text-zinc-600 group-hover:text-zinc-400 transition-colors leading-tight">
                  {option.description}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
