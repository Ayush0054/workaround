import type { ScoredRepo } from '#/lib/repo-scoring'

export type DashboardFilter = 'all' | 'flagged' | 'ai' | 'nlp'
export type SearchScope = 'starred' | 'github' | 'both'

export interface DashboardAuth {
  login: string
  name: string | null
  avatarUrl: string
}

export interface DashboardPageProps {
  auth: DashboardAuth
  repos: ScoredRepo[]
  truncated: boolean
  aiEnabled: boolean
  onRefresh: () => void
}

export interface DashboardTab {
  value: DashboardFilter
  label: string
  count: number | null
}
