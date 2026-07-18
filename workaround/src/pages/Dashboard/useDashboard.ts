import { Either } from 'effect'
import { useEffect, useMemo, useRef, useState } from 'react'
import { attempt, originalError, runResult } from '#/lib/errors'
import { dashboardSearchSchema } from '#/schemas/dashboard'
import {
  analyzeStars,
  getActiveSweeps,
  getStars,
  getSweepStatus,
  searchGithub,
  semanticFilterStars,
  star,
  startSweep,
  unstar,
} from '#/server/routes'
import type { AiVerdict } from '#/types/ai'
import type { SearchResult } from '#/types/github'
import type { StarredRepositories } from '#/types/stars'
import type { SweepStatus, SweepTarget } from '#/types/sweep'
import {
  CONFIRMATION_TIMEOUT_MS,
  FILTER_LABELS,
  SWEEP_POLL_INTERVAL_MS,
  UNSTAR_PACING_MS,
} from './constants'
import type { DashboardFilter, DashboardTab, SearchScope } from './types'
import { getSweepFailureHint, sleep } from './utils'

const VERDICT_ORDER: Record<AiVerdict['verdict'], number> = {
  unstar: 0,
  unsure: 1,
  keep: 2,
}

function indexVerdicts(
  verdicts: readonly AiVerdict[],
): Record<string, AiVerdict> {
  const indexed: Record<string, AiVerdict> = {}
  for (const verdict of verdicts) indexed[verdict.fullName] = verdict
  return indexed
}

export function useDashboard(initialRepositories: StarredRepositories) {
  const skipInitialPageLoad = useRef(true)
  const [repositories, setRepositories] = useState(initialRepositories)
  const [pageLoading, setPageLoading] = useState(false)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [query, setQuery] = useState('')
  const [filter, setFilterState] = useState<DashboardFilter>('all')
  const [selectedRepos, setSelectedRepos] = useState<
    ReadonlyMap<string, SweepTarget>
  >(new Map())
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set())
  const [inFlight, setInFlight] = useState<ReadonlySet<string>>(new Set())
  const [verdicts, setVerdicts] = useState<Record<string, AiVerdict>>(() =>
    indexVerdicts(initialRepositories.savedVerdicts),
  )
  const [analyzing, setAnalyzing] = useState(false)
  const [sweeping, setSweeping] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [sweepNotice, setSweepNotice] = useState<string | null>(null)
  const [sweepJobId, setSweepJobId] = useState<string | null>(null)
  const [scope, setScope] = useState<SearchScope>('starred')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [nlpMatches, setNlpMatches] = useState<string[] | null>(null)
  const [ghResults, setGhResults] = useState<SearchResult[] | null>(null)
  const [translatedQuery, setTranslatedQuery] = useState<string | null>(null)
  const [ghBusy, setGhBusy] = useState<ReadonlySet<string>>(new Set())
  const [ghStarredOverride, setGhStarredOverride] = useState<
    Record<string, boolean>
  >({})

  useEffect(() => {
    if (!confirming) return
    const timeout = setTimeout(
      () => setConfirming(false),
      CONFIRMATION_TIMEOUT_MS,
    )
    return () => clearTimeout(timeout)
  }, [confirming])

  useEffect(() => {
    if (skipInitialPageLoad.current) {
      skipInitialPageLoad.current = false
      return
    }

    let cancelled = false
    setSearchError(null)
    setPageLoading(true)

    void runResult(
      attempt(() => getStars(), 'Could not load repositories'),
    ).then((result) => {
      if (cancelled) return
      setPageLoading(false)
      if (Either.isLeft(result)) {
        setSearchError(result.left.message)
        return
      }

      setRepositories(result.right)
      setVerdicts(indexVerdicts(result.right.savedVerdicts))
    })

    return () => {
      cancelled = true
    }
  }, [refreshVersion])

  const selected = useMemo(() => new Set(selectedRepos.keys()), [selectedRepos])
  const visible = useMemo(() => {
    let filtered = repositories.repos.filter(
      (repo) => !removed.has(repo.fullName),
    )

    if (filter === 'flagged') {
      filtered = filtered
        .filter((repo) => repo.signals.length > 0)
        .sort((left, right) => right.score - left.score)
    } else if (filter === 'ai') {
      filtered = filtered
        .filter((repo) => verdicts[repo.fullName] !== undefined)
        .sort((left, right) => {
          const leftVerdict = verdicts[left.fullName]
          const rightVerdict = verdicts[right.fullName]
          if (!leftVerdict || !rightVerdict) return 0
          return (
            VERDICT_ORDER[leftVerdict.verdict] -
            VERDICT_ORDER[rightVerdict.verdict]
          )
        })
    } else if (filter === 'nlp') {
      const rank = new Map(
        (nlpMatches ?? []).map((fullName, index) => [fullName, index]),
      )
      filtered = filtered
        .filter((repo) => rank.has(repo.fullName))
        .sort(
          (left, right) =>
            (rank.get(left.fullName) ?? Number.MAX_SAFE_INTEGER) -
            (rank.get(right.fullName) ?? Number.MAX_SAFE_INTEGER),
        )
    }

    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return filtered
    return filtered.filter(
      (repo) =>
        repo.fullName.toLowerCase().includes(normalizedQuery) ||
        repo.description?.toLowerCase().includes(normalizedQuery),
    )
  }, [filter, nlpMatches, query, removed, repositories.repos, verdicts])
  const liveNames = useMemo(
    () =>
      new Set(
        repositories.starredNames.filter((fullName) => !removed.has(fullName)),
      ),
    [repositories.starredNames, removed],
  )

  const allVisibleSelected =
    visible.length > 0 && visible.every((repo) => selected.has(repo.fullName))
  const someVisibleSelected = visible.some((repo) =>
    selected.has(repo.fullName),
  )

  function setFilter(nextFilter: DashboardFilter) {
    setFilterState(nextFilter)
  }

  function toggleRepo(fullName: string, next: boolean) {
    const repo = visible.find((candidate) => candidate.fullName === fullName)
    if (next && !repo) return

    setSelectedRepos((previous) => {
      const updated = new Map(previous)
      if (next && repo) {
        updated.set(fullName, {
          owner: repo.owner,
          name: repo.name,
          fullName: repo.fullName,
        })
      } else {
        updated.delete(fullName)
      }
      return updated
    })
  }

  function toggleAllVisible(next: boolean) {
    setSelectedRepos((previous) => {
      const updated = new Map(previous)
      for (const repo of visible) {
        if (next) {
          updated.set(repo.fullName, {
            owner: repo.owner,
            name: repo.name,
            fullName: repo.fullName,
          })
        } else {
          updated.delete(repo.fullName)
        }
      }
      return updated
    })
  }

  async function analyze(prompt?: string) {
    const normalizedPrompt = prompt?.trim()
    setAnalyzing(true)
    setSearchError(null)

    const result = await runResult(
      attempt(
        () => analyzeStars({ data: { prompt: normalizedPrompt } }),
        'AI review failed — try again.',
      ),
    )

    setAnalyzing(false)
    if (Either.isLeft(result)) {
      setSearchError(result.left.message)
      return
    }

    setVerdicts((previous) => {
      const updated = { ...previous }
      for (const verdict of result.right.verdicts)
        updated[verdict.fullName] = verdict
      return updated
    })

    if (normalizedPrompt) {
      setNlpMatches(result.right.matches ?? [])
      setFilter('nlp')
    } else {
      setFilter('ai')
    }
    setRefreshVersion((version) => version + 1)
  }

  async function askAi() {
    if (searching) return

    const search = dashboardSearchSchema.safeParse({ query, scope })
    if (!search.success) return
    const { query: normalizedQuery } = search.data

    const wantsStarred = scope === 'starred' || scope === 'both'
    const wantsGithub = scope === 'github' || scope === 'both'

    if (wantsStarred && !repositories.aiEnabled) {
      setSearchError(
        'Semantic search over your stars needs an AI provider. GitHub-wide search works without it — switch the scope.',
      )
      return
    }

    setSearching(true)
    setSearchError(null)
    const result = await runResult(
      attempt(
        () =>
          Promise.all([
            wantsStarred
              ? semanticFilterStars({ data: { query: normalizedQuery } })
              : null,
            wantsGithub
              ? searchGithub({ data: { query: normalizedQuery } })
              : null,
          ]),
        'Search failed — try again.',
      ),
    )

    setSearching(false)
    if (Either.isLeft(result)) {
      setSearchError(result.left.message)
      return
    }

    const [starredResult, githubResult] = result.right
    if (starredResult) {
      setNlpMatches(starredResult.matches)
      setFilter('nlp')
    }
    if (githubResult) {
      setGhResults(githubResult.results)
      setTranslatedQuery(githubResult.translatedQuery)
      setGhStarredOverride({})
    }
  }

  function clearNlp() {
    setNlpMatches(null)
    if (filter === 'nlp') setFilter('all')
  }

  function isGhStarred(fullName: string): boolean {
    return ghStarredOverride[fullName] ?? liveNames.has(fullName)
  }

  async function toggleGhStar(result: SearchResult) {
    const currentlyStarred = isGhStarred(result.fullName)
    setGhBusy((previous) => new Set(previous).add(result.fullName))
    const payload = { data: { owner: result.owner, repo: result.name } }
    const outcome = await runResult(
      attempt(
        () => (currentlyStarred ? unstar(payload) : star(payload)),
        `Could not update star for ${result.fullName}`,
      ),
    )

    setGhBusy((previous) => {
      const updated = new Set(previous)
      updated.delete(result.fullName)
      return updated
    })
    if (Either.isLeft(outcome)) {
      setSearchError(outcome.left.message)
      return
    }

    setGhStarredOverride((previous) => ({
      ...previous,
      [result.fullName]: !currentlyStarred,
    }))
    if (currentlyStarred) {
      setRemoved((previous) => new Set(previous).add(result.fullName))
      setSelectedRepos((previous) => {
        const updated = new Map(previous)
        updated.delete(result.fullName)
        return updated
      })
      setRefreshVersion((version) => version + 1)
    } else {
      setRemoved((previous) => {
        const updated = new Set(previous)
        updated.delete(result.fullName)
        return updated
      })
      setRefreshVersion((version) => version + 1)
    }
  }

  function applySweepStatus(status: SweepStatus) {
    setInFlight(new Set(status.pending))
    setRemoved((previous) => new Set([...previous, ...status.completed]))
    setSelectedRepos((previous) => {
      const updated = new Map(previous)
      for (const fullName of status.completed) updated.delete(fullName)
      return updated
    })
  }

  useEffect(() => {
    if (!repositories.queueEnabled) return
    let cancelled = false

    void runResult(
      attempt(() => getActiveSweeps(), 'Could not resume the active sweep'),
    ).then((result) => {
      if (cancelled || Either.isLeft(result) || result.right.length === 0)
        return
      const active = result.right[0]
      applySweepStatus(active)
      setSweeping(true)
      setSweepJobId(active.jobId)
    })

    return () => {
      cancelled = true
    }
  }, [repositories.queueEnabled])

  useEffect(() => {
    if (!sweepJobId) return
    let cancelled = false
    let pollTimer: ReturnType<typeof setTimeout> | undefined

    const poll = async () => {
      const result = await runResult(
        attempt(
          () => getSweepStatus({ data: { jobId: sweepJobId } }),
          'Could not read sweep progress',
        ),
      )
      if (cancelled) return

      if (Either.isLeft(result) || !result.right) {
        const message = Either.isLeft(result)
          ? result.left.message
          : 'Sweep job was not found'
        setSweepNotice(message)
        setSweeping(false)
        setInFlight(new Set())
        setSweepJobId(null)
        return
      }

      const status = result.right
      applySweepStatus(status)
      if (status.done + status.failed >= status.total) {
        setSweeping(false)
        setSweepJobId(null)
        setRefreshVersion((version) => version + 1)
        if (status.failed > 0) {
          const firstError = status.failures[0]?.error ?? 'Unknown error'
          setSweepNotice(
            `${status.done} unstarred · ${status.failed} failed and stayed in the list. First error: ${firstError}. ${getSweepFailureHint(firstError)}`,
          )
        }
        return
      }

      pollTimer = setTimeout(poll, SWEEP_POLL_INTERVAL_MS)
    }

    void poll()
    return () => {
      cancelled = true
      if (pollTimer) clearTimeout(pollTimer)
    }
  }, [sweepJobId])

  function requestUnstar() {
    if (!confirming) {
      setConfirming(true)
      return
    }
    setConfirming(false)
    void unstarSelected()
  }

  async function unstarSelected() {
    if (sweeping) return
    const targets = [...selectedRepos.values()]
    if (targets.length === 0) return

    setSweeping(true)
    setSweepNotice(null)
    setInFlight(new Set(targets.map((repo) => repo.fullName)))

    if (repositories.queueEnabled) {
      const result = await runResult(
        attempt(
          () => startSweep({ data: { targets } }),
          'Could not queue this sweep',
        ),
      )
      if (Either.isLeft(result)) {
        setSweepNotice(result.left.message)
        setSweeping(false)
        setInFlight(new Set())
        console.error('Could not queue sweep:', originalError(result.left))
        return
      }

      applySweepStatus(result.right)
      setSweepJobId(result.right.jobId)
      return
    }

    let failed = 0
    let firstError: string | null = null
    let first = true
    for (const repo of targets) {
      if (!first) await sleep(UNSTAR_PACING_MS)
      first = false
      const result = await runResult(
        attempt(
          () => unstar({ data: { owner: repo.owner, repo: repo.name } }),
          `Unstar failed for ${repo.fullName}`,
        ),
      )

      if (Either.isRight(result)) {
        setRemoved((previous) => new Set(previous).add(repo.fullName))
        setSelectedRepos((previous) => {
          const updated = new Map(previous)
          updated.delete(repo.fullName)
          return updated
        })
      } else {
        failed++
        firstError ??= result.left.message
        console.error(
          `Unstar failed for ${repo.fullName}:`,
          originalError(result.left),
        )
      }

      setInFlight((previous) => {
        const updated = new Set(previous)
        updated.delete(repo.fullName)
        return updated
      })
    }

    if (failed > 0) {
      setSweepNotice(
        `${targets.length - failed} unstarred · ${failed} failed and stayed in the list. First error: ${firstError ?? 'unknown'}. ${getSweepFailureHint(firstError)}`,
      )
    }
    setSweeping(false)
    setRefreshVersion((version) => version + 1)
  }

  const tabs: DashboardTab[] = FILTER_LABELS.map(({ value, label }) => ({
    value,
    label,
    count: value === 'flagged' ? repositories.flaggedCount || null : null,
  }))
  if (nlpMatches !== null)
    tabs.push({ value: 'nlp', label: 'AI matches', count: nlpMatches.length })

  return {
    aiEnabled: repositories.aiEnabled,
    allVisibleSelected,
    analyze,
    analyzing,
    askAi,
    clearGitHubResults: () => setGhResults(null),
    clearNlp,
    confirming,
    dismissSweepNotice: () => setSweepNotice(null),
    filter,
    flaggedCount: repositories.flaggedCount,
    ghBusy,
    ghResults,
    inFlight,
    isGhStarred,
    liveCount: repositories.liveCount,
    nlpMatches,
    pageLoading,
    query,
    refreshPage: () => setRefreshVersion((version) => version + 1),
    reviewedCount: repositories.reviewedCount,
    requestUnstar,
    scope,
    searchError,
    searching,
    selected,
    selectedCount: selected.size,
    setFilter,
    setQuery,
    setScope,
    someVisibleSelected,
    sweepNotice,
    sweeping,
    sweptCount: removed.size,
    tabs,
    toggleAllVisible,
    toggleGhStar,
    toggleRepo,
    translatedQuery,
    truncated: repositories.truncated,
    verdicts,
    visible,
  }
}
