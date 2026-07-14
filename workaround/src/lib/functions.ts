import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { Effect, Either } from 'effect'
import { attempt, originalError, runResult } from '#/lib/errors'
import { scoreRepos } from '#/lib/repo-scoring'
import { env } from '#/server/env'
import {
  GitHubApiError,
  fetchAllStars,
  fetchReadmeHtml,
  fetchRepo,
  searchRepos,
  starRepo,
  unstarRepo,
  viewerHasStarred,
} from '#/server/github'
import { getAppSession } from '#/server/session'
import { aiConfigured, aiReview, semanticMatch, toSearchQuery } from '#/server/suggest'
import type { CandidatePayload, CompactRepo } from '#/server/suggest'
import {
  activeSweeps,
  enqueueSweep,
  queueConfigured,
  sweepStatus,
} from '#/server/sweep'
import type { SweepTarget } from '#/server/sweep'
import { loadAiVerdicts, saveAiVerdicts } from '#/server/verdicts'

async function requireSession(): Promise<{ login: string; token: string }> {
  const session = await getAppSession()
  const { login, token } = session.data
  if (!login || !token) throw new Error('Not signed in')
  return { login, token }
}

async function requireToken(): Promise<string> {
  return (await requireSession()).token
}

export const getAuth = createServerFn({ method: 'GET' }).handler(async () => {
  // Unconfigured env (fresh clone, no .dev.vars yet) should render the
  // dashboard as signed-out instead of crashing on session decryption.
  if (!env.SESSION_SECRET) return null

  const session = await getAppSession()
  if (!session.data.token || !session.data.login) return null
  return {
    login: session.data.login,
    name: session.data.name ?? null,
    avatarUrl: session.data.avatarUrl ?? '',
  }
})

export const getStars = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getAppSession()
  const token = session.data.token
  const login = session.data.login
  if (!token || !login) throw redirect({ to: '/dashboard' })

  const result = await runResult(attempt(() => fetchAllStars(token), 'Could not load starred repositories'))
  if (Either.isLeft(result)) {
    const error = originalError(result.left)
    if (error instanceof GitHubApiError && error.status === 401) {
      await session.clear()
      throw redirect({ to: '/dashboard', search: { error: 'session_expired' } })
    }
    throw error
  }

  const savedVerdictsResult = await runResult(
    attempt(() => loadAiVerdicts(login), 'Could not load saved AI verdicts'),
  )

  return {
    repos: scoreRepos(result.right.repos),
    truncated: result.right.truncated,
    aiEnabled: aiConfigured(),
    queueEnabled: queueConfigured(),
    savedVerdicts: Either.isRight(savedVerdictsResult) ? savedVerdictsResult.right : [],
  }
})

const MAX_SWEEP_TARGETS = 3000

export const startSweep = createServerFn({ method: 'POST' })
  .validator((data: { targets: SweepTarget[] }) => data)
  .handler(async ({ data }) => {
    if (!queueConfigured()) throw new Error('Cloudflare Queue and D1 bindings are not configured')
    const { login, token } = await requireSession()
    const uniqueTargets = Array.from(
      new Map(
        data.targets
          .slice(0, MAX_SWEEP_TARGETS)
          .map((target) => [target.fullName, target] as const),
      ).values(),
    )
    if (uniqueTargets.length === 0) throw new Error('Select at least one repository')
    return enqueueSweep(login, token, uniqueTargets)
  })

export const getSweepStatus = createServerFn({ method: 'GET' })
  .validator((data: { jobId: string }) => data)
  .handler(async ({ data }) => {
    if (!queueConfigured()) return null
    const { login } = await requireSession()
    return sweepStatus(login, data.jobId)
  })

export const getActiveSweeps = createServerFn({ method: 'GET' }).handler(async () => {
  if (!queueConfigured()) return []
  const { login } = await requireSession()
  return activeSweeps(login)
})

export const unstar = createServerFn({ method: 'POST' })
  .validator((data: { owner: string; repo: string }) => data)
  .handler(async ({ data }) => {
    const token = await requireToken()
    await unstarRepo(token, data.owner, data.repo)
    return { ok: true as const }
  })

export const star = createServerFn({ method: 'POST' })
  .validator((data: { owner: string; repo: string }) => data)
  .handler(async ({ data }) => {
    const token = await requireToken()
    await starRepo(token, data.owner, data.repo)
    return { ok: true as const }
  })

export const MAX_AI_CANDIDATES = 120

export const analyzeStars = createServerFn({ method: 'POST' })
  .validator((data: { candidates: CandidatePayload[] }) => data)
  .handler(async ({ data }) => {
    const { login } = await requireSession()
    const candidates = data.candidates.slice(0, MAX_AI_CANDIDATES)
    const verdicts = await aiReview(candidates)
    await saveAiVerdicts(login, verdicts)
    return { verdicts, analyzed: candidates.length }
  })

const MAX_SEMANTIC_CATALOG = 1500

export const semanticFilterStars = createServerFn({ method: 'POST' })
  .validator((data: { query: string; repos: CompactRepo[] }) => data)
  .handler(async ({ data }) => {
    await requireToken()
    const matches = await semanticMatch(data.query, data.repos.slice(0, MAX_SEMANTIC_CATALOG))
    return { matches }
  })

export const searchGithub = createServerFn({ method: 'POST' })
  .validator((data: { query: string }) => data)
  .handler(async ({ data }) => {
    const token = await requireToken()
    const q = await toSearchQuery(data.query)
    const results = await searchRepos(token, q)
    return { results, translatedQuery: q }
  })

export const getRepoInfo = createServerFn({ method: 'GET' })
  .validator((data: { owner: string; name: string }) => data)
  .handler(async ({ data }) => {
    const session = await getAppSession()
    const token = session.data.token
    if (!token) throw redirect({ to: '/dashboard' })

    const result = await runResult(
      Effect.all(
        {
          repo: attempt(() => fetchRepo(token, data.owner, data.name), 'Could not load repository'),
          readmeHtml: attempt(() => fetchReadmeHtml(token, data.owner, data.name)).pipe(
            Effect.catchAll(() => Effect.succeed(null)),
          ),
          starred: attempt(
            () => viewerHasStarred(token, data.owner, data.name),
            'Could not load repository star status',
          ),
        },
        { concurrency: 'unbounded' },
      ),
    )

    if (Either.isLeft(result)) throw originalError(result.left)
    return result.right
  })
