import { Either } from 'effect'
import { attempt, runResult } from '#/lib/errors'

const GITHUB_API = 'https://api.github.com'

export class GitHubApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(message)
    this.name = 'GitHubApiError'
  }

  /** Secondary rate limits surface as 403/429 with a retry-after header. */
  get rateLimited(): boolean {
    return this.status === 403 || this.status === 429
  }
}

export type Viewer = {
  login: string
  name: string | null
  avatarUrl: string
}

export type StarredRepo = {
  id: number
  fullName: string
  owner: string
  name: string
  description: string | null
  htmlUrl: string
  language: string | null
  stargazersCount: number
  pushedAt: string | null
  archived: boolean
  fork: boolean
  starredAt: string
}

function headers(token: string, accept = 'application/vnd.github+json') {
  return {
    Authorization: `Bearer ${token}`,
    Accept: accept,
    'User-Agent': 'workaround',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

export async function exchangeCode(params: {
  clientId: string
  clientSecret: string
  code: string
  redirectUri: string
}): Promise<string> {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      code: params.code,
      redirect_uri: params.redirectUri,
    }),
  })
  if (!res.ok) throw new Error(`Token exchange failed (${res.status})`)
  const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string }
  if (!data.access_token) {
    throw new Error(data.error_description ?? data.error ?? 'Token exchange returned no access token')
  }
  return data.access_token
}

export async function fetchViewer(token: string): Promise<Viewer> {
  const res = await fetch(`${GITHUB_API}/user`, { headers: headers(token) })
  if (!res.ok) throw new Error(`GitHub /user failed (${res.status})`)
  const u = (await res.json()) as { login: string; name: string | null; avatar_url: string }
  return { login: u.login, name: u.name, avatarUrl: u.avatar_url }
}

/**
 * Fetches the viewer's starred repos with starred_at timestamps
 * (application/vnd.github.star+json media type).
 *
 * Capped at maxPages to stay within Workers subrequest limits;
 * pass the cap through to the UI so truncation is never silent.
 */
export async function fetchAllStars(
  token: string,
  maxPages = 30,
): Promise<{ repos: StarredRepo[]; truncated: boolean }> {
  const repos: StarredRepo[] = []
  let truncated = false

  for (let page = 1; page <= maxPages; page++) {
    const res = await fetch(`${GITHUB_API}/user/starred?per_page=100&page=${page}`, {
      headers: headers(token, 'application/vnd.github.star+json'),
    })
    if (!res.ok) {
      throw new GitHubApiError(`GitHub /user/starred failed (${res.status})`, res.status)
    }

    const batch = (await res.json()) as Array<{
      starred_at: string
      repo: {
        id: number
        full_name: string
        name: string
        owner: { login: string }
        description: string | null
        html_url: string
        language: string | null
        stargazers_count: number
        pushed_at: string | null
        archived: boolean
        fork: boolean
      }
    }>

    for (const item of batch) {
      const r = item.repo
      repos.push({
        id: r.id,
        fullName: r.full_name,
        owner: r.owner.login,
        name: r.name,
        description: r.description,
        htmlUrl: r.html_url,
        language: r.language,
        stargazersCount: r.stargazers_count,
        pushedAt: r.pushed_at,
        archived: r.archived,
        fork: r.fork,
        starredAt: item.starred_at,
      })
    }

    if (batch.length < 100) return { repos, truncated }
    if (page === maxPages) truncated = true
  }

  return { repos, truncated }
}

export async function unstarRepo(token: string, owner: string, repo: string): Promise<void> {
  const res = await fetch(
    `${GITHUB_API}/user/starred/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    { method: 'DELETE', headers: headers(token) },
  )
  // 204 = unstarred, 404 = was not starred (treat as success — desired state reached)
  if (res.status !== 204 && res.status !== 404) {
    const retryAfter = Number(res.headers.get('retry-after')) || undefined
    // GitHub's 403s say exactly what's wrong — surface it instead of guessing
    const body = await runResult(
      attempt(() => res.json() as Promise<{ message?: string }>, 'GitHub returned an invalid error response'),
    )
    let detail = Either.isRight(body) && body.right.message ? ` — ${body.right.message}` : ''
    const needs = res.headers.get('x-accepted-github-permissions')
    if (needs) detail += ` [needs: ${needs}]`
    throw new GitHubApiError(`Unstar failed for ${owner}/${repo} (${res.status})${detail}`, res.status, retryAfter)
  }
}

export async function starRepo(token: string, owner: string, repo: string): Promise<void> {
  const res = await fetch(
    `${GITHUB_API}/user/starred/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    { method: 'PUT', headers: { ...headers(token), 'Content-Length': '0' } },
  )
  if (res.status !== 204) throw new Error(`Star failed for ${owner}/${repo} (${res.status})`)
}

export async function viewerHasStarred(token: string, owner: string, repo: string): Promise<boolean> {
  const res = await fetch(
    `${GITHUB_API}/user/starred/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    { headers: headers(token) },
  )
  if (res.status === 204) return true
  if (res.status === 404) return false
  throw new Error(`GitHub star status failed for ${owner}/${repo} (${res.status})`)
}

export type RepoDetail = {
  fullName: string
  owner: string
  name: string
  description: string | null
  htmlUrl: string
  homepage: string | null
  language: string | null
  topics: string[]
  license: string | null
  stargazersCount: number
  forksCount: number
  watchersCount: number
  openIssuesCount: number
  createdAt: string
  pushedAt: string | null
  archived: boolean
  fork: boolean
}

export async function fetchRepo(token: string, owner: string, repo: string): Promise<RepoDetail> {
  const res = await fetch(
    `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    { headers: headers(token) },
  )
  if (!res.ok) throw new Error(`GitHub /repos failed (${res.status})`)
  const r = (await res.json()) as {
    full_name: string
    name: string
    owner: { login: string }
    description: string | null
    html_url: string
    homepage: string | null
    language: string | null
    topics?: string[]
    license: { spdx_id: string | null } | null
    stargazers_count: number
    forks_count: number
    subscribers_count: number
    open_issues_count: number
    created_at: string
    pushed_at: string | null
    archived: boolean
    fork: boolean
  }
  return {
    fullName: r.full_name,
    owner: r.owner.login,
    name: r.name,
    description: r.description,
    htmlUrl: r.html_url,
    homepage: r.homepage,
    language: r.language,
    topics: r.topics ?? [],
    license: r.license?.spdx_id && r.license.spdx_id !== 'NOASSERTION' ? r.license.spdx_id : null,
    stargazersCount: r.stargazers_count,
    forksCount: r.forks_count,
    watchersCount: r.subscribers_count,
    openIssuesCount: r.open_issues_count,
    createdAt: r.created_at,
    pushedAt: r.pushed_at,
    archived: r.archived,
    fork: r.fork,
  }
}

/** README pre-rendered to HTML by GitHub (already sanitized by their renderer). */
export async function fetchReadmeHtml(token: string, owner: string, repo: string): Promise<string | null> {
  const res = await fetch(
    `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`,
    { headers: headers(token, 'application/vnd.github.html+json') },
  )
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GitHub /readme failed (${res.status})`)
  return res.text()
}

export type SearchResult = {
  id: number
  fullName: string
  owner: string
  name: string
  description: string | null
  htmlUrl: string
  language: string | null
  stargazersCount: number
  pushedAt: string | null
  archived: boolean
}

export async function searchRepos(token: string, query: string, perPage = 20): Promise<SearchResult[]> {
  const url = new URL(`${GITHUB_API}/search/repositories`)
  url.searchParams.set('q', query)
  url.searchParams.set('per_page', String(perPage))
  const res = await fetch(url, { headers: headers(token) })
  if (!res.ok) throw new Error(`GitHub search failed (${res.status})`)
  const data = (await res.json()) as {
    items: Array<{
      id: number
      full_name: string
      name: string
      owner: { login: string }
      description: string | null
      html_url: string
      language: string | null
      stargazers_count: number
      pushed_at: string | null
      archived: boolean
    }>
  }
  return data.items.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    owner: r.owner.login,
    name: r.name,
    description: r.description,
    htmlUrl: r.html_url,
    language: r.language,
    stargazersCount: r.stargazers_count,
    pushedAt: r.pushed_at,
    archived: r.archived,
  }))
}
