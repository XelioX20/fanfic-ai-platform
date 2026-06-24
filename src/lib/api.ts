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
