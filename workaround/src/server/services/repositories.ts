import { redirect } from '@tanstack/react-router'
import { Effect, Either } from 'effect'
import { attempt, originalError, runResult } from '#/lib/errors'
import { scoreRepos } from '#/lib/repo-scoring'
import { getAppSession } from '../session'
import { requireToken } from './auth'
import { aiConfigured, toSearchQuery } from './ai'
import {
  GitHubApiError,
  fetchAllStars,
  fetchReadmeHtml,
  fetchRepo,
  searchRepos,
  starRepo,
  unstarRepo,
  viewerHasStarred,
} from './github'
import { queueConfigured } from './sweep'
import { loadAiVerdicts } from './verdicts'
import { trackEvent } from './analytics'
import type { AiVerdict } from '#/types/ai'
import type { StarredRepositories } from '#/types/stars'
import type { RepositoryInput, StarInput } from '../schemas'
import type { StarCatalog } from '../types/repositories'

export async function loadStarCatalog(): Promise<StarCatalog> {
  const session = await getAppSession()
  const token = session.data.token
  const login = session.data.login
  if (!token || !login) throw redirect({ to: '/' })

  const result = await runResult(
    Effect.all(
      {
        stars: attempt(
          () => fetchAllStars(token),
          'Could not load starred repositories',
        ),
        verdicts: attempt(
          () => loadAiVerdicts(login),
          'Could not load saved AI verdicts',
        ).pipe(Effect.catchAll(() => Effect.succeed<AiVerdict[]>([]))),
      },
      { concurrency: 'unbounded' },
    ),
  )
  if (Either.isLeft(result)) {
    const error = originalError(result.left)
    if (error instanceof GitHubApiError && error.status === 401) {
      await session.clear()
      throw redirect({ to: '/', search: { error: 'session_expired' } })
    }
    throw error
  }

  return {
    login,
    repos: scoreRepos(result.right.stars.repos),
    verdicts: result.right.verdicts,
    truncated: result.right.stars.truncated,
  }
}

export async function getStarredRepositories(): Promise<StarredRepositories> {
  const catalog = await loadStarCatalog()
  const liveRepos = catalog.repos
  const reviewedNames = new Set(
    catalog.verdicts.map((verdict) => verdict.fullName),
  )
  const flaggedCount = liveRepos.filter(
    (repo) => repo.signals.length > 0,
  ).length
  const reviewedCount = liveRepos.filter(
    (repo) => reviewedNames.has(repo.fullName),
  ).length

  return {
    repos: liveRepos,
    liveCount: liveRepos.length,
    flaggedCount,
    reviewedCount,
    starredNames: liveRepos.map((repo) => repo.fullName),
    savedVerdicts: catalog.verdicts,
    truncated: catalog.truncated,
    aiEnabled: aiConfigured(),
    queueEnabled: queueConfigured(),
  }
}

export async function unstarRepository({
  owner,
  repo,
}: StarInput): Promise<{ ok: true }> {
  await unstarRepo(await requireToken(), owner, repo)
  trackEvent({ name: 'star_update', dimension: 'unstar' })
  return { ok: true }
}

export async function starRepository({
  owner,
  repo,
}: StarInput): Promise<{ ok: true }> {
  await starRepo(await requireToken(), owner, repo)
  trackEvent({ name: 'star_update', dimension: 'star' })
  return { ok: true }
}

export async function searchGitHubRepositories(query: string) {
  const token = await requireToken()
  const translatedQuery = await toSearchQuery(query)
  const results = await searchRepos(token, translatedQuery)
  return { results, translatedQuery }
}

export async function getRepositoryInfo({ owner, name }: RepositoryInput) {
  const session = await getAppSession()
  const token = session.data.token
  if (!token) throw redirect({ to: '/' })

  const result = await runResult(
    Effect.all(
      {
        repo: attempt(
          () => fetchRepo(token, owner, name),
          'Could not load repository',
        ),
        readmeHtml: attempt(() => fetchReadmeHtml(token, owner, name)).pipe(
          Effect.catchAll(() => Effect.succeed(null)),
        ),
        starred: attempt(
          () => viewerHasStarred(token, owner, name),
          'Could not load repository star status',
        ),
      },
      { concurrency: 'unbounded' },
    ),
  )

  if (Either.isLeft(result)) throw originalError(result.left)
  return result.right
}
