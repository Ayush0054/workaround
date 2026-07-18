import type { ScoredRepo } from '#/lib/repo-scoring'
import type { AiVerdict } from './ai'

export interface StarredRepositories {
  repos: ScoredRepo[]
  liveCount: number
  flaggedCount: number
  reviewedCount: number
  starredNames: string[]
  savedVerdicts: AiVerdict[]
  truncated: boolean
  aiEnabled: boolean
  queueEnabled: boolean
}
