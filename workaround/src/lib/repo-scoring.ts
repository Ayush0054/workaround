import type { StarredRepo } from '#/types/github'

export type Signal =
  'archived' | 'deprecated' | 'stale' | 'very-stale' | 'old-star'

export type ScoredRepo = StarredRepo & {
  score: number
  signals: Signal[]
}

const YEAR_MS = 365 * 24 * 60 * 60 * 1000
const DEPRECATED_RE =
  /\b(deprecated|unmaintained|no longer maintained|abandoned|archived|moved to|superseded by)\b/i

export function yearsSince(
  iso: string | null,
  now = Date.now(),
): number | null {
  return iso ? Math.floor((now - Date.parse(iso)) / YEAR_MS) : null
}

export function isDeprecated(description: string | null): boolean {
  return description ? DEPRECATED_RE.test(description) : false
}

/** Deterministic cleanup signals; AI only reviews the candidates these surface. */
export function scoreRepo(repo: StarredRepo, now = Date.now()): ScoredRepo {
  const signals: Signal[] = []
  let score = 0

  if (repo.archived) {
    signals.push('archived')
    score += 50
  }
  if (isDeprecated(repo.description)) {
    signals.push('deprecated')
    score += 40
  }

  if (repo.pushedAt) {
    const age = now - Date.parse(repo.pushedAt)
    if (age > 4 * YEAR_MS) {
      signals.push('very-stale')
      score += 35
    } else if (age > 2 * YEAR_MS) {
      signals.push('stale')
      score += 20
    }
  }

  if (now - Date.parse(repo.starredAt) > 3 * YEAR_MS) {
    signals.push('old-star')
    score += 15
  }

  return { ...repo, score, signals }
}

export function scoreRepos(repos: StarredRepo[]): ScoredRepo[] {
  const now = Date.now()
  return repos.map((repo) => scoreRepo(repo, now))
}
