import type { ScoredRepo } from '#/lib/repo-scoring'
import type { AiVerdict } from '#/server/suggest'

export type DashboardFilter = 'all' | 'flagged' | 'ai' | 'nlp'
export type SearchScope = 'starred' | 'github' | 'both'

export interface DashboardAuth {
  login: string
  name: string | null
  avatarUrl: string
}

export interface DashboardPageProps {
  auth: DashboardAuth | null
  authError?: string
  repos: ScoredRepo[]
  truncated: boolean
  aiEnabled: boolean
  queueEnabled: boolean
  savedVerdicts: AiVerdict[]
  onRefresh: () => void
}

export interface DashboardTab {
  value: DashboardFilter
  label: string
  count: number | null
}
