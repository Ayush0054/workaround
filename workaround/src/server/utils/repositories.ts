import { MAX_AI_CANDIDATES } from '../schemas'
import type { ScoredRepo } from '#/lib/repo-scoring'
import type { CandidatePayload } from '#/types/ai'

export function buildAiCandidates(repos: ScoredRepo[]): CandidatePayload[] {
  return [...repos]
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_AI_CANDIDATES)
    .map((repo) => ({
      fullName: repo.fullName,
      description: repo.description,
      language: repo.language,
      stargazersCount: repo.stargazersCount,
      pushedAt: repo.pushedAt,
      starredAt: repo.starredAt,
      archived: repo.archived,
      signals: repo.signals,
    }))
}
