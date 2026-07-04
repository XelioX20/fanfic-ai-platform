'use client'
import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface State {
  error: Error | null
}

/**
 * Catches render errors in its children and shows a readable message with
 * the underlying error's `.message`, instead of Next.js's opaque
 * "Application error: a client-side exception has occurred" default.
 *
 * Wrap any client-side subtree whose failure would otherwise vanish into the
 * production error boundary. In dev the browser console still prints the
 * full stack.
 */
export class ClientErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface to whichever error tracker is loaded, if any.
    // In production we still want the console entry for post-mortem.
    // eslint-disable-next-line no-console
    console.error('[ClientErrorBoundary]', error, info.componentStack)
  }

  private reset = () => {
    this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset)
      }
      return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-zinc-900 border border-red-900/50 rounded-xl p-6 space-y-3">
            <h1 className="text-lg font-semibold text-red-300">
              Ошибка при рендере страницы
            </h1>
            <p className="text-sm text-zinc-300 whitespace-pre-wrap break-words font-mono">
              {this.state.error.message || String(this.state.error)}
            </p>
            {this.state.error.stack && (
              <details className="text-xs text-zinc-500">
                <summary className="cursor-pointer hover:text-zinc-300">Stack trace</summary>
                <pre className="mt-2 text-[10px] whitespace-pre-wrap break-words">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={this.reset}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Попробовать снова
              </button>
              <a
                href="/"
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-sm font-medium transition-colors"
              >
                На главную
              </a>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
