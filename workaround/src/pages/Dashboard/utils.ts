import { MAX_AI_CANDIDATES } from '#/lib/functions'
import type { ScoredRepo } from '#/lib/repo-scoring'
import type { AiVerdict, CandidatePayload } from '#/server/suggest'
import { AI_VERDICT_ORDER } from './constants'
import type { DashboardFilter } from './types'

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function buildAiCandidates(repos: ScoredRepo[]): CandidatePayload[] {
  return [...repos]
    .sort((a, b) => b.score - a.score)
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

export function getVisibleRepos({
  repos,
  flagged,
  filter,
  query,
  verdicts,
  nlpMatches,
}: {
  repos: ScoredRepo[]
  flagged: ScoredRepo[]
  filter: DashboardFilter
  query: string
  verdicts: Record<string, AiVerdict>
  nlpMatches: string[] | null
}): ScoredRepo[] {
  if (filter === 'nlp' && nlpMatches) {
    const rank = new Map(nlpMatches.map((fullName, index) => [fullName, index]))
    return repos
      .filter((repo) => rank.has(repo.fullName))
      .sort((a, b) => rank.get(a.fullName)! - rank.get(b.fullName)!)
  }

  let visible: ScoredRepo[]
  if (filter === 'flagged') {
    visible = [...flagged].sort((a, b) => b.score - a.score)
  } else if (filter === 'ai') {
    visible = repos
      .filter((repo) => verdicts[repo.fullName])
      .sort(
        (a, b) =>
          AI_VERDICT_ORDER[verdicts[a.fullName].verdict] -
          AI_VERDICT_ORDER[verdicts[b.fullName].verdict],
      )
  } else {
    visible = repos
  }

  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return visible
  return visible.filter(
    (repo) =>
      repo.fullName.toLowerCase().includes(normalizedQuery) ||
      repo.description?.toLowerCase().includes(normalizedQuery),
  )
}

export function getSweepFailureHint(error: string | null): string {
  if (error?.includes('(403)')) {
    return 'A 403 usually means the GitHub app is missing the "Starring: write" permission, or GitHub is rate-limiting writes.'
  }
  if (error?.includes('(429)')) {
    return 'GitHub is rate-limiting writes — give it a minute and sweep again.'
  }
  return 'If this keeps happening, restart the dev server and hard-refresh this page.'
}
