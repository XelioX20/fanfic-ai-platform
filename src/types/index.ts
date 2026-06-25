export interface FanficAIScores {
  romance_score?: number
  angst_score?: number
  fluff_score?: number
  drama_score?: number
  humor_score?: number
  adventure_score?: number
  mystery_score?: number
  emotional_intensity?: number
  narrative_depth?: number
  writing_quality?: number
}

export interface FanficTag {
  name: string
  is_adult: boolean
}

export interface FanficPairing {
  characters: string[]
  is_highlight?: boolean
}

export interface Fanfic {
  id: string
  title: string
  description?: string
  author_name: string
  author_id?: string
  fandoms: string[]
  pairings: FanficPairing[]
  tags: FanficTag[]
  direction: string
  rating: string
  completion_status: string
  likes: number
  trophies: number
  words_count: number
  chapters_count: number
  comments_count: number
  cover_url?: string
  ficbook_url: string
  is_hot: boolean
  ai_scores?: FanficAIScores
  published_at?: string
  updated_at?: string
}

export interface FanficListResponse {
  items: Fanfic[]
  total: number
  page: number
  page_size: number
  has_next: boolean
}

export interface SearchResponse extends FanficListResponse {
  search_type?: string
  parsed_filters?: Record<string, unknown>
  took_ms?: number
}

export interface RecommendationItem {
  fanfic_id: string
  score: number
  explanation?: string
}

export interface User {
  id: string
  ficbook_user_id?: string
  ficbook_username?: string
  ficbook_avatar_url?: string
  ficbook_profile_url?: string
}

export interface AuthTokens {
  access_token: string
  token_type: string
}

export type Theme = 'light' | 'dark' | 'amoled'

export interface ReaderSettings {
  font_size: number
  font_family: 'sans' | 'serif'
  line_height: number
  max_width: number
  theme: Theme
}
