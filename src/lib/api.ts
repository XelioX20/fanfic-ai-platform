import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  timeout: 15000,
})

api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined'
    ? localStorage.getItem('access_token')
    : null
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('access_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const fanficsApi = {
  list: (params: Record<string, unknown>) => api.get('/fanfics/', { params }),
  getById: (id: string) => api.get(`/fanfics/${id}`),
}

export const searchApi = {
  search: (query: string, page = 1, pageSize = 20) =>
    api.get('/search/', { params: { q: query, page, page_size: pageSize } }),
  suggest: (q: string) => api.get('/search/suggest', { params: { q } }),
}

export const recommendationsApi = {
  forMe: (page = 1) => api.get('/recommendations/for-me', { params: { page } }),
  similar: (fanficId: string, limit = 10) =>
    api.get(`/recommendations/similar/${fanficId}`, { params: { limit } }),
  trending: (period = 'week') => api.get('/recommendations/trending', { params: { period } }),
}

export const usersApi = {
  register: (email: string, password: string) =>
    api.post('/users/register', { email, password }),
  login: (email: string, password: string) =>
    api.post('/users/login', { email, password }),
  me: () => api.get('/users/me'),
}

export const interactionsApi = {
  record: (data: {
    fanfic_id: string
    interaction_type: string
    reading_progress?: number
    reading_time_seconds?: number
    chapter_id?: string
  }) => api.post('/interactions/', data),
}

export const authApi = {
  ficbookLogin: (ficbook_login: string, ficbook_password: string) =>
    api.post('/auth/ficbook/login', { ficbook_login, ficbook_password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
}

export const profileApi = {
  me: () => api.get('/profile/me'),
  favourites: (page = 1) => api.get('/profile/favourites', { params: { page } }),
  history: (page = 1) => api.get('/profile/history', { params: { page } }),
  liked: (page = 1) => api.get('/profile/liked', { params: { page } }),
  subscriptions: (page = 1) => api.get('/profile/subscriptions', { params: { page } }),
  updateAvatar: (avatar_url: string) => api.put('/profile/avatar', { avatar_url }),
  deleteAvatar: () => api.delete('/profile/avatar'),
}

export const discoverApi = {
  search: (params: {
    direction?: string
    mood?: string
    size?: string
    status?: string
    category?: string
    page?: number
  }) => api.get('/discover/discover', { params }),
}

// Ficbook proxy — routes through Vercel (not blocked like Render datacenter IP)
export const ficbookProxyApi = {
  // Fetch fanfic list — Next.js route proxies to ficbook.net
  list: (path: string, page = 1, cookie?: string) => {
    const params = new URLSearchParams({ path, p: String(page) })
    if (cookie) params.set('cookie', cookie)
    return api.get(`/api/ficbook/list?${params}`, { baseURL: '' })
  },
  // Search fanfics through Next.js proxy
  search: (q: string, page = 1) =>
    api.get(`/api/ficbook/search?q=${encodeURIComponent(q)}&p=${page}`, { baseURL: '' }),
  // Login via Next.js proxy
  login: (login: string, password: string) =>
    fetch('/api/ficbook/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password }),
    }).then(r => r.json()),
}

/* ─── Reading state (anchors + local history) ─────────────────────────
 *
 * User-scoped, cross-device. Client Zustand store mirrors these on-device
 * for instant UX; a hydrator in providers.tsx does the initial pull and
 * every mutation pushes to the server best-effort.
 */

export interface ServerAnchor {
  fanfic_id: string
  chapter_id: string
  scroll_y: number
  chapter_title: string | null
  updated_at: string
}

export interface ServerHistoryEntry {
  fanfic_id: string
  title: string
  author_name: string
  author_id: string | null
  cover_url: string | null
  direction: string | null
  rating: string | null
  completion_status: string | null
  fandoms: string[] | null
  opened_at: string
}

export interface ServerBookmark {
  fanfic_id: string
  title: string
  author_name: string
  author_id: string | null
  cover_url: string | null
  direction: string | null
  rating: string | null
  completion_status: string | null
  fandoms: string[] | null
  added_at: string
}

export const readingStateApi = {
  listAnchors: () => api.get<ServerAnchor[]>('/profile/anchors'),
  upsertAnchor: (fanficId: string, body: { chapter_id: string; scroll_y: number; chapter_title?: string | null }) =>
    api.put<ServerAnchor>(`/profile/anchors/${encodeURIComponent(fanficId)}`, body),
  deleteAnchor: (fanficId: string) =>
    api.delete(`/profile/anchors/${encodeURIComponent(fanficId)}`),

  listHistory: (limit = 200) =>
    api.get<ServerHistoryEntry[]>('/profile/local-history', { params: { limit } }),
  upsertHistory: (fanficId: string, body: {
    title: string
    author_name?: string
    author_id?: string | null
    cover_url?: string | null
    direction?: string | null
    rating?: string | null
    completion_status?: string | null
    fandoms?: string[] | null
  }) => api.put<ServerHistoryEntry>(`/profile/local-history/${encodeURIComponent(fanficId)}`, body),
  deleteHistoryEntry: (fanficId: string) =>
    api.delete(`/profile/local-history/${encodeURIComponent(fanficId)}`),
  clearHistory: () => api.delete('/profile/local-history'),

  listBookmarks: (limit = 500) =>
    api.get<ServerBookmark[]>('/profile/bookmarks', { params: { limit } }),
  upsertBookmark: (fanficId: string, body: {
    title: string
    author_name?: string
    author_id?: string | null
    cover_url?: string | null
    direction?: string | null
    rating?: string | null
    completion_status?: string | null
    fandoms?: string[] | null
  }) => api.put<ServerBookmark>(`/profile/bookmarks/${encodeURIComponent(fanficId)}`, body),
  deleteBookmark: (fanficId: string) =>
    api.delete(`/profile/bookmarks/${encodeURIComponent(fanficId)}`),
}
