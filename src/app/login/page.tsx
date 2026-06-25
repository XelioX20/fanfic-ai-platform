'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, BookOpen, Loader2, AlertCircle, WifiOff, Clock } from 'lucide-react'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/store'

type ErrorType = 'credentials' | 'network' | 'timeout' | 'server' | 'unknown'

interface LoginError {
  type: ErrorType
  message: string
  hint?: string
}

function parseError(err: unknown): LoginError {
  const e = err as {
    code?: string
    response?: { status?: number; data?: { detail?: string } }
    message?: string
  }

  // Network / timeout
  if (e.code === 'ECONNABORTED' || e.message?.includes('timeout')) {
    return {
      type: 'timeout',
      message: 'Сервер не ответил вовремя.',
      hint: 'Возможно, сервер просыпается после простоя. Подожди 30 секунд и попробуй ещё раз.',
    }
  }
  if (e.code === 'ERR_NETWORK' || e.message?.includes('Network Error')) {
    return {
      type: 'network',
      message: 'Нет соединения с сервером.',
      hint: 'Проверь интернет-соединение или попробуй позже.',
    }
  }

  const status = e.response?.status
  const detail = e.response?.data?.detail || ''

  if (status === 401 || detail.toLowerCase().includes('invalid') || detail.toLowerCase().includes('credential')) {
    return {
      type: 'credentials',
      message: 'Неверный логин или пароль.',
      hint: 'Используй те же данные, что и на ficbook.net.',
    }
  }
  if (status === 503 || detail.includes('ficbook_parser')) {
    return {
      type: 'server',
      message: 'Сервис временно недоступен.',
      hint: 'Попробуй через несколько минут.',
    }
  }
  if (status === 502 || detail.includes('ficbook.net')) {
    return {
      type: 'server',
      message: 'Не удалось соединиться с ficbook.net.',
      hint: 'Возможно, ficbook.net временно недоступен.',
    }
  }
  if (status && status >= 500) {
    return {
      type: 'server',
      message: `Ошибка сервера (${status}).`,
      hint: 'Попробуй ещё раз через минуту.',
    }
  }

  return {
    type: 'unknown',
    message: detail || 'Не удалось войти.',
    hint: 'Попробуй ещё раз.',
  }
}

const ERROR_ICONS: Record<ErrorType, React.ReactNode> = {
  credentials: <AlertCircle size={15} />,
  network: <WifiOff size={15} />,
  timeout: <Clock size={15} />,
  server: <AlertCircle size={15} />,
  unknown: <AlertCircle size={15} />,
}

export default function LoginPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<LoginError | null>(null)
  const [loadingHint, setLoadingHint] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!login.trim() || !password.trim()) return
    setLoading(true)
    setError(null)
    setLoadingHint(null)

    // After 8s show hint that server might be waking up
    const hintTimer = setTimeout(() => {
      setLoadingHint('Сервер просыпается, это может занять до 30 секунд…')
    }, 8000)

    try {
      const res = await authApi.ficbookLogin(login.trim(), password)
      const data = res.data
      setAuth(
        {
          id: data.user_id,
          ficbook_username: data.ficbook_username,
          ficbook_avatar_url: data.ficbook_avatar_url,
        },
        data.access_token,
      )
      // If not remembering — store token in sessionStorage only (clears on tab close)
      if (!rememberMe) {
        localStorage.removeItem('access_token')
        sessionStorage.setItem('access_token', data.access_token)
      }
      router.push('/')
    } catch (err: unknown) {
      setError(parseError(err))
    } finally {
      clearTimeout(hintTimer)
      setLoading(false)
      setLoadingHint(null)
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <BookOpen size={28} className="text-purple-500" />
          <span className="text-xl font-bold text-zinc-100">Fanfic AI Platform</span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h1 className="text-lg font-semibold text-zinc-100 mb-1">Вход</h1>
          <p className="text-sm text-zinc-500 mb-6">
            Используй свой аккаунт{' '}
            <a href="https://ficbook.net" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">
              ficbook.net
            </a>
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Логин или email
              </label>
              <input
                type="text"
                value={login}
                onChange={e => { setLogin(e.target.value); setError(null) }}
                placeholder="Имя пользователя"
                autoComplete="username"
                required
                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-purple-500 transition-colors text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Пароль</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(null) }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full px-3 py-2.5 pr-10 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-purple-500 transition-colors text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <div
                onClick={() => setRememberMe(!rememberMe)}
                className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                  rememberMe
                    ? 'bg-purple-600 border-purple-600'
                    : 'bg-transparent border-zinc-600 hover:border-zinc-400'
                }`}
              >
                {rememberMe && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span className="text-sm text-zinc-400">Запомнить меня</span>
            </label>

            {/* Loading hint */}
            {loading && loadingHint && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-zinc-800/60 border border-zinc-700 rounded-lg text-zinc-400 text-xs">
                <Clock size={13} className="flex-shrink-0 text-zinc-500" />
                {loadingHint}
              </div>
            )}

            {/* Error block */}
            {error && (
              <div className="px-3 py-3 bg-red-950/40 border border-red-800/50 rounded-lg space-y-1">
                <div className="flex items-center gap-2 text-red-400 text-sm font-medium">
                  {ERROR_ICONS[error.type]}
                  {error.message}
                </div>
                {error.hint && (
                  <p className="text-red-500/70 text-xs pl-5">{error.hint}</p>
                )}
                {error.type === 'credentials' && (
                  <p className="text-zinc-600 text-xs pl-5 mt-1">
                    <a href="https://ficbook.net/login" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-zinc-300 underline">
                      Войти напрямую на ficbook.net →
                    </a>
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !login.trim() || !password.trim()}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Входим…
                </>
              ) : (
                'Войти'
              )}
            </button>
          </form>

          <p className="text-xs text-zinc-600 text-center mt-4">
            Нет аккаунта?{' '}
            <a href="https://ficbook.net/register" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-zinc-300">
              Зарегистрируйся на ficbook.net
            </a>
          </p>
        </div>
      </div>
    </main>
  )
}


  return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <BookOpen size={28} className="text-purple-500" />
          <span className="text-xl font-bold text-zinc-100">Fanfic AI Platform</span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h1 className="text-lg font-semibold text-zinc-100 mb-1">Вход</h1>
          <p className="text-sm text-zinc-500 mb-6">
            Используй свой аккаунт{' '}
            <a href="https://ficbook.net" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">
              ficbook.net
            </a>
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Логин или email
              </label>
              <input
                type="text"
                value={login}
                onChange={e => setLogin(e.target.value)}
                placeholder="Имя пользователя"
                autoComplete="username"
                required
                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-purple-500 transition-colors text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Пароль</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full px-3 py-2.5 pr-10 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-purple-500 transition-colors text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="px-3 py-2.5 bg-red-950/50 border border-red-800/50 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !login.trim() || !password.trim()}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Входим…
                </>
              ) : (
                'Войти'
              )}
            </button>
          </form>

          <p className="text-xs text-zinc-600 text-center mt-4">
            Нет аккаунта?{' '}
            <a href="https://ficbook.net/register" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-zinc-300">
              Зарегистрируйся на ficbook.net
            </a>
          </p>
        </div>
      </div>
    </main>
  )
}
