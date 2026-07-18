import type { ScoredRepo } from '#/lib/repo-scoring'
import type { AiVerdict } from '#/types/ai'

export interface StarCatalog {
  login: string
  repos: ScoredRepo[]
  verdicts: AiVerdict[]
  truncated: boolean
}
