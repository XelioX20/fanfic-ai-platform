'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { BookOpen, User, LogOut, ChevronDown, Heart, Clock, Users } from 'lucide-react'
import { useAuthStore } from '@/store'
import { authApi } from '@/lib/api'
import { SearchBar } from '@/components/search/SearchBar'

export function Header() {
  const router = useRouter()
  const { user, accessToken, clearAuth } = useAuthStore()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    try { await authApi.logout() } catch {}
    clearAuth()
    setMenuOpen(false)
    router.push('/')
  }

  return (
    <header className="sticky top-0 z-50 bg-zinc-900/95 backdrop-blur border-b border-zinc-800">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <BookOpen size={20} className="text-purple-500" />
          <span className="font-bold text-zinc-100 hidden sm:block">Fanfic AI</span>
        </Link>

        {/* Search */}
        <div className="flex-1 max-w-xl">
          <SearchBar className="w-full" />
        </div>

        {/* Auth */}
        <div className="flex-shrink-0">
          {!accessToken ? (
            <Link
              href="/login"
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Войти
            </Link>
          ) : (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                {user?.ficbook_avatar_url ? (
                  <Image
                    src={user.ficbook_avatar_url}
                    alt={user.ficbook_username || 'avatar'}
                    width={28}
                    height={28}
                    className="rounded-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-purple-700 flex items-center justify-center">
                    <User size={14} className="text-white" />
                  </div>
                )}
                <span className="text-zinc-300 text-sm hidden sm:block max-w-[120px] truncate">
                  {user?.ficbook_username || 'Профиль'}
                </span>
                <ChevronDown size={14} className="text-zinc-500" />
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 w-48 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 py-1 overflow-hidden">
                    <Link
                      href="/profile"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
                    >
                      <User size={14} /> Профиль
                    </Link>
                    <Link
                      href="/profile?tab=favourites"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
                    >
                      <Heart size={14} /> Избранное
                    </Link>
                    <Link
                      href="/profile?tab=history"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
                    >
                      <Clock size={14} /> История
                    </Link>
                    <Link
                      href="/profile?tab=subscriptions"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
                    >
                      <Users size={14} /> Подписки
                    </Link>
                    <div className="border-t border-zinc-800 my-1" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-zinc-800 transition-colors"
                    >
                      <LogOut size={14} /> Выйти
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
