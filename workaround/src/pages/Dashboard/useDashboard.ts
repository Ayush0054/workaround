import { Either } from 'effect'
import { useEffect, useMemo, useState } from 'react'
import { attempt, originalError, runResult } from '#/lib/errors'
import {
  analyzeStars,
  searchGithub,
  semanticFilterStars,
  star,
  unstar,
} from '#/lib/functions'
import type { SearchResult } from '#/server/github'
import type { AiVerdict } from '#/server/suggest'
import { CONFIRMATION_TIMEOUT_MS, FILTER_LABELS, UNSTAR_PACING_MS } from './constants'
import type { DashboardFilter, DashboardPageProps, DashboardTab, SearchScope } from './types'
import { buildAiCandidates, getSweepFailureHint, getVisibleRepos, sleep } from './utils'

export function useDashboard({ repos, aiEnabled }: Pick<DashboardPageProps, 'repos' | 'aiEnabled'>) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<DashboardFilter>('all')
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set())
  const [inFlight, setInFlight] = useState<ReadonlySet<string>>(new Set())
  const [verdicts, setVerdicts] = useState<Record<string, AiVerdict>>({})
  const [analyzing, setAnalyzing] = useState(false)
  const [sweeping, setSweeping] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [sweepNotice, setSweepNotice] = useState<string | null>(null)
  const [scope, setScope] = useState<SearchScope>('starred')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [nlpMatches, setNlpMatches] = useState<string[] | null>(null)
  const [ghResults, setGhResults] = useState<SearchResult[] | null>(null)
  const [translatedQuery, setTranslatedQuery] = useState<string | null>(null)
  const [ghBusy, setGhBusy] = useState<ReadonlySet<string>>(new Set())
  const [ghStarredOverride, setGhStarredOverride] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!confirming) return
    const timeout = setTimeout(() => setConfirming(false), CONFIRMATION_TIMEOUT_MS)
    return () => clearTimeout(timeout)
  }, [confirming])

  const live = useMemo(() => repos.filter((repo) => !removed.has(repo.fullName)), [repos, removed])
  const flagged = useMemo(() => live.filter((repo) => repo.signals.length > 0), [live])
  const liveNames = useMemo(() => new Set(live.map((repo) => repo.fullName)), [live])
  const visible = useMemo(
    () => getVisibleRepos({ repos: live, flagged, filter, query, verdicts, nlpMatches }),
    [live, flagged, filter, query, verdicts, nlpMatches],
  )

  const allVisibleSelected = visible.length > 0 && visible.every((repo) => selected.has(repo.fullName))
  const someVisibleSelected = visible.some((repo) => selected.has(repo.fullName))

  function toggleRepo(fullName: string, next: boolean) {
    setSelected((previous) => {
      const updated = new Set(previous)
      if (next) updated.add(fullName)
      else updated.delete(fullName)
      return updated
    })
  }

  function toggleAllVisible(next: boolean) {
    setSelected((previous) => {
      const updated = new Set(previous)
      for (const repo of visible) {
        if (next) updated.add(repo.fullName)
        else updated.delete(repo.fullName)
      }
      return updated
    })
  }

  async function analyze() {
    setAnalyzing(true)
    setSearchError(null)

    const candidates = buildAiCandidates(flagged)
    const result = await runResult(
      attempt(() => analyzeStars({ data: { candidates } }), 'AI review failed — try again.'),
    )

    setAnalyzing(false)
    if (Either.isLeft(result)) {
      setSearchError(result.left.message)
      return
    }

    setVerdicts((previous) => {
      const updated = { ...previous }
      for (const verdict of result.right.verdicts) updated[verdict.fullName] = verdict
      return updated
    })
    setFilter('ai')
  }

  async function askAi() {
    const normalizedQuery = query.trim()
    if (!normalizedQuery || searching) return

    const wantsStarred = scope === 'starred' || scope === 'both'
    const wantsGithub = scope === 'github' || scope === 'both'

    if (wantsStarred && !aiEnabled) {
      setSearchError(
        'Semantic search over your stars needs ANTHROPIC_API_KEY. GitHub-wide search works without it — switch the scope.',
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
              ? semanticFilterStars({
                  data: {
                    query: normalizedQuery,
                    repos: live.map((repo) => ({
                      fullName: repo.fullName,
                      description: repo.description,
                      language: repo.language,
                    })),
                  },
                })
              : Promise.resolve(null),
            wantsGithub ? searchGithub({ data: { query: normalizedQuery } }) : Promise.resolve(null),
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

    setGhStarredOverride((previous) => ({ ...previous, [result.fullName]: !currentlyStarred }))
    if (liveNames.has(result.fullName) && currentlyStarred) {
      setRemoved((previous) => new Set(previous).add(result.fullName))
    } else if (!currentlyStarred) {
      setRemoved((previous) => {
        const updated = new Set(previous)
        updated.delete(result.fullName)
        return updated
      })
    }
  }

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
    const targets = live.filter((repo) => selected.has(repo.fullName))
    if (targets.length === 0) return

    setSweeping(true)
    setSweepNotice(null)
    setInFlight(new Set(targets.map((repo) => repo.fullName)))

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
        setSelected((previous) => {
          const updated = new Set(previous)
          updated.delete(repo.fullName)
          return updated
        })
      } else {
        failed++
        firstError ??= result.left.message
        console.error(`Unstar failed for ${repo.fullName}:`, originalError(result.left))
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
  }

  const tabs: DashboardTab[] = FILTER_LABELS.map(({ value, label }) => ({
    value,
    label,
    count: value === 'flagged' ? flagged.length || null : null,
  }))
  if (nlpMatches !== null) tabs.push({ value: 'nlp', label: 'AI matches', count: nlpMatches.length })

  return {
    aiEnabled,
    allVisibleSelected,
    analyze,
    analyzing,
    askAi,
    clearGitHubResults: () => setGhResults(null),
    clearNlp,
    confirming,
    dismissSweepNotice: () => setSweepNotice(null),
    filter,
    flaggedCount: flagged.length,
    ghBusy,
    ghResults,
    inFlight,
    isGhStarred,
    liveCount: live.length,
    nlpMatches,
    query,
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
    verdicts,
    visible,
  }
}
