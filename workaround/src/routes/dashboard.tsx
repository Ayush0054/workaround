import { createFileRoute, redirect } from '@tanstack/react-router'
import { Github, Loader2, Search, Sparkles, Star, Trash2, WandSparkles, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { RepoRow } from '#/components/RepoRow'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import { Input } from '#/components/ui/input'
import {
  analyzeStars,
  getActiveSweeps,
  getAuth,
  getStars,
  getSweepStatus,
  searchGithub,
  semanticFilterStars,
  star,
  startSweep,
  unstar,
} from '#/lib/functions'
import { cn, formatCount, timeAgo } from '#/lib/utils'
import type { SearchResult } from '#/server/github'
import type { AiVerdict, ScoredRepo } from '#/server/suggest'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async () => {
    const auth = await getAuth()
    if (!auth) throw redirect({ to: '/' })
    return { auth }
  },
  loader: () => getStars(),
  component: Dashboard,
})

type Filter = 'all' | 'flagged' | 'ai' | 'nlp'
type Scope = 'starred' | 'github' | 'both'

const UNSTAR_CONCURRENCY = 4

async function runPool<T>(items: T[], worker: (item: T) => Promise<void>, concurrency: number) {
  const queue = [...items]
  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
        await worker(item)
      }
    }),
  )
}

function Dashboard() {
  const { auth } = Route.useRouteContext()
  const { repos, truncated, aiEnabled, queueEnabled } = Route.useLoaderData()

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set())
  const [inFlight, setInFlight] = useState<ReadonlySet<string>>(new Set())
  const [verdicts, setVerdicts] = useState<Record<string, AiVerdict>>({})
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number; failed: number } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // NLP search
  const [scope, setScope] = useState<Scope>('starred')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [nlpMatches, setNlpMatches] = useState<string[] | null>(null)
  const [ghResults, setGhResults] = useState<SearchResult[] | null>(null)
  const [translatedQuery, setTranslatedQuery] = useState<string | null>(null)
  const [ghBusy, setGhBusy] = useState<ReadonlySet<string>>(new Set())
  const [ghStarredOverride, setGhStarredOverride] = useState<Record<string, boolean>>({})

  const live = useMemo(() => repos.filter((r) => !removed.has(r.fullName)), [repos, removed])
  const flagged = useMemo(() => live.filter((r) => r.signals.length > 0), [live])
  const liveNames = useMemo(() => new Set(live.map((r) => r.fullName)), [live])

  const visible = useMemo(() => {
    if (filter === 'nlp' && nlpMatches) {
      const rank = new Map(nlpMatches.map((n, i) => [n, i]))
      return live
        .filter((r) => rank.has(r.fullName))
        .sort((a, b) => rank.get(a.fullName)! - rank.get(b.fullName)!)
    }

    let list: ScoredRepo[]
    if (filter === 'flagged') {
      list = [...flagged].sort((a, b) => b.score - a.score)
    } else if (filter === 'ai') {
      const rank = { unstar: 0, unsure: 1, keep: 2 } as const
      list = live
        .filter((r) => verdicts[r.fullName])
        .sort((a, b) => rank[verdicts[a.fullName].verdict] - rank[verdicts[b.fullName].verdict])
    } else {
      list = live
    }
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (r) => r.fullName.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q),
    )
  }, [live, flagged, filter, query, verdicts, nlpMatches])

  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.fullName))
  const someVisibleSelected = visible.some((r) => selected.has(r.fullName))

  function toggleRepo(fullName: string, next: boolean) {
    setSelected((prev) => {
      const set = new Set(prev)
      if (next) set.add(fullName)
      else set.delete(fullName)
      return set
    })
  }

  function toggleAllVisible(next: boolean) {
    setSelected((prev) => {
      const set = new Set(prev)
      for (const r of visible) {
        if (next) set.add(r.fullName)
        else set.delete(r.fullName)
      }
      return set
    })
  }

  async function analyze() {
    setAnalyzing(true)
    try {
      const candidates = [...flagged]
        .sort((a, b) => b.score - a.score)
        .slice(0, 120)
        .map((r) => ({
          fullName: r.fullName,
          description: r.description,
          language: r.language,
          stargazersCount: r.stargazersCount,
          pushedAt: r.pushedAt,
          starredAt: r.starredAt,
          archived: r.archived,
          signals: r.signals,
        }))
      const { verdicts: results } = await analyzeStars({ data: { candidates } })
      setVerdicts((prev) => {
        const next = { ...prev }
        for (const v of results) next[v.fullName] = v
        return next
      })
      setFilter('ai')
    } finally {
      setAnalyzing(false)
    }
  }

  async function askAi() {
    const q = query.trim()
    if (!q || searching) return

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
    try {
      const [starredRes, githubRes] = await Promise.all([
        wantsStarred
          ? semanticFilterStars({
              data: {
                query: q,
                repos: live.map((r) => ({
                  fullName: r.fullName,
                  description: r.description,
                  language: r.language,
                })),
              },
            })
          : Promise.resolve(null),
        wantsGithub ? searchGithub({ data: { query: q } }) : Promise.resolve(null),
      ])

      if (starredRes) {
        setNlpMatches(starredRes.matches)
        setFilter('nlp')
      }
      if (githubRes) {
        setGhResults(githubRes.results)
        setTranslatedQuery(githubRes.translatedQuery)
        setGhStarredOverride({})
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed — try again.')
    } finally {
      setSearching(false)
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
    const currently = isGhStarred(result.fullName)
    setGhBusy((prev) => new Set(prev).add(result.fullName))
    try {
      const payload = { data: { owner: result.owner, repo: result.name } }
      if (currently) await unstar(payload)
      else await star(payload)
      setGhStarredOverride((prev) => ({ ...prev, [result.fullName]: !currently }))
      // Keep the main list consistent when the repo is one of the loaded stars
      if (liveNames.has(result.fullName) && currently) {
        setRemoved((prev) => new Set(prev).add(result.fullName))
      } else if (!currently) {
        setRemoved((prev) => {
          const set = new Set(prev)
          set.delete(result.fullName)
          return set
        })
      }
    } catch {
      setSearchError(`Could not update star for ${result.fullName}`)
    } finally {
      setGhBusy((prev) => {
        const set = new Set(prev)
        set.delete(result.fullName)
        return set
      })
    }
  }

  function requestUnstar() {
    if (!confirming) {
      setConfirming(true)
      if (confirmTimer.current) clearTimeout(confirmTimer.current)
      confirmTimer.current = setTimeout(() => setConfirming(false), 4000)
      return
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current)
    setConfirming(false)
    void unstarSelected()
  }

  function pollSweep(jobId: string) {
    if (pollTimer.current) clearTimeout(pollTimer.current)
    const tick = async () => {
      try {
        const s = await getSweepStatus({ data: { jobId } })
        setProgress({ done: s.done + s.failed, total: s.total, failed: s.failed })
        if (s.done + s.failed >= s.total) {
          setTimeout(() => setProgress(null), 2500)
          return
        }
      } catch {
        // transient — keep polling
      }
      pollTimer.current = setTimeout(() => void tick(), 1500)
    }
    void tick()
  }

  // Resume any sweep still draining server-side from a previous visit
  useEffect(() => {
    if (!queueEnabled) return
    let cancelled = false
    void getActiveSweeps().then((jobs) => {
      if (cancelled || jobs.length === 0) return
      setRemoved((prev) => {
        const set = new Set(prev)
        for (const job of jobs) for (const fullName of job.pending) set.add(fullName)
        return set
      })
      const latest = jobs[0]
      setProgress({ done: latest.done + latest.failed, total: latest.total, failed: latest.failed })
      pollSweep(latest.jobId)
    })
    return () => {
      cancelled = true
      if (pollTimer.current) clearTimeout(pollTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueEnabled])

  async function unstarSelected() {
    const targets = live.filter((r) => selected.has(r.fullName))
    if (targets.length === 0) return

    if (queueEnabled) {
      // Background sweep: enqueue once, the queue consumer talks to GitHub —
      // safe to close the tab, progress resumes on the next visit.
      setProgress({ done: 0, total: targets.length, failed: 0 })
      try {
        const { jobId } = await startSweep({
          data: { targets: targets.map((r) => ({ owner: r.owner, name: r.name, fullName: r.fullName })) },
        })
        setRemoved((prev) => {
          const set = new Set(prev)
          for (const r of targets) set.add(r.fullName)
          return set
        })
        setSelected(new Set())
        pollSweep(jobId)
      } catch {
        setProgress(null)
        setSearchError('Could not start the sweep — try again.')
      }
      return
    }

    setProgress({ done: 0, total: targets.length, failed: 0 })
    setInFlight(new Set(targets.map((r) => r.fullName)))

    await runPool(
      targets,
      async (repo) => {
        try {
          await unstar({ data: { owner: repo.owner, repo: repo.name } })
          setRemoved((prev) => new Set(prev).add(repo.fullName))
          setSelected((prev) => {
            const set = new Set(prev)
            set.delete(repo.fullName)
            return set
          })
          setProgress((p) => (p ? { ...p, done: p.done + 1 } : p))
        } catch {
          setProgress((p) => (p ? { ...p, done: p.done + 1, failed: p.failed + 1 } : p))
        } finally {
          setInFlight((prev) => {
            const set = new Set(prev)
            set.delete(repo.fullName)
            return set
          })
        }
      },
      UNSTAR_CONCURRENCY,
    )

    setTimeout(() => setProgress(null), 2500)
  }

  const swept = removed.size
  const selectedCount = selected.size

  const tabs: Array<[Filter, string, number | null]> = [
    ['all', 'All', null],
    ['flagged', 'Flagged', flagged.length || null],
    ['ai', 'AI verdicts', null],
  ]
  if (nlpMatches !== null) tabs.push(['nlp', 'AI matches', nlpMatches.length])

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-accent/40 bg-accent-soft">
              <Star className="h-3.5 w-3.5 fill-accent text-accent-strong" />
            </span>
            <span className="font-syne text-sm tracking-tight">workaround</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {auth.avatarUrl && (
                <img src={auth.avatarUrl} alt="" className="h-6 w-6 rounded-full border border-border" />
              )}
              <span className="font-mono text-xs text-muted-foreground">{auth.login}</span>
            </div>
            <form action="/api/auth/logout" method="post">
              <Button variant="ghost" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-8 pb-16">
        <div className="rise-in mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-cantarell text-2xl font-bold tracking-tight">Starred repos</h1>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {live.length} starred · {flagged.length} flagged
              {swept > 0 && <span className="text-accent-strong"> · {swept} swept this session</span>}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="accent"
              onClick={() => void analyze()}
              disabled={!aiEnabled || analyzing || flagged.length === 0}
              title={aiEnabled ? undefined : 'Set ANTHROPIC_API_KEY to enable AI review'}
            >
              {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {analyzing ? 'Reviewing…' : 'AI review'}
            </Button>
            <Button
              variant="destructive"
              onClick={requestUnstar}
              disabled={selectedCount === 0 || progress !== null}
              className={cn(confirming && 'animate-pulse')}
            >
              <Trash2 className="h-4 w-4" />
              {confirming ? `Really unstar ${selectedCount}?` : `Unstar ${selectedCount || ''}`}
            </Button>
          </div>
        </div>

        {truncated && (
          <p className="mb-4 rounded-lg border border-accent/40 bg-accent-soft px-3 py-2 font-mono text-xs text-accent-strong">
            Showing your 3,000 most recent stars — older ones are not loaded yet.
          </p>
        )}

        {progress && (
          <div className="mb-4">
            <div className="mb-1 flex justify-between font-mono text-xs text-muted-foreground">
              <span>
                sweeping {progress.done}/{progress.total}
                {progress.failed > 0 && <span className="text-destructive"> · {progress.failed} failed</span>}
                {queueEnabled && <span className="text-faint"> · runs in background, safe to close the tab</span>}
              </span>
              <span>{Math.round((progress.done / progress.total) * 100)}%</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-300"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div className="relative min-w-64 flex-1">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-faint" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void askAi()
              }}
              placeholder="Filter instantly, or describe a repo and press Enter to ask AI…"
              className="pl-9"
            />
          </div>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as Scope)}
            aria-label="Search scope"
            className="h-9 cursor-pointer rounded-lg border border-input bg-card px-2.5 text-sm shadow-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring/40"
          >
            <option value="starred">My stars</option>
            <option value="github">All GitHub</option>
            <option value="both">Both</option>
          </select>
          <Button variant="outline" onClick={() => void askAi()} disabled={searching || !query.trim()}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
            Ask AI
          </Button>
        </div>

        {searchError && (
          <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive-soft px-3 py-2 text-xs text-destructive">
            {searchError}
          </p>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border bg-muted p-0.5">
            {tabs.map(([value, label, count]) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={cn(
                  'cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  filter === value ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
                {count !== null && (
                  <span className="ml-1.5 font-mono text-[10px] text-accent-strong">{count}</span>
                )}
              </button>
            ))}
          </div>
          {nlpMatches !== null && (
            <button
              onClick={clearNlp}
              className="inline-flex cursor-pointer items-center gap-1 font-mono text-[11px] text-faint hover:text-foreground"
            >
              <X className="h-3 w-3" />
              clear AI matches
            </button>
          )}
        </div>

        <div className="rise-in overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-3 border-b border-border bg-muted/50 px-4 py-2">
            <Checkbox
              checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
              onCheckedChange={toggleAllVisible}
              aria-label="Select all visible"
            />
            <span className="font-mono text-xs text-muted-foreground">
              {visible.length} shown{selectedCount > 0 && ` · ${selectedCount} selected`}
            </span>
            {filter === 'ai' && Object.keys(verdicts).length > 0 && (
              <Badge variant="flag" className="ml-auto">
                <Sparkles className="h-3 w-3" />
                {Object.keys(verdicts).length} reviewed
              </Badge>
            )}
          </div>

          {visible.length === 0 ? (
            <div className="px-4 py-16 text-center">
              <p className="text-sm text-muted-foreground">
                {live.length === 0
                  ? 'No starred repos found — nothing to sweep.'
                  : filter === 'ai'
                    ? 'No AI verdicts yet — run an AI review on your flagged repos.'
                    : filter === 'nlp'
                      ? 'No starred repos matched that description.'
                      : 'Nothing matches this filter.'}
              </p>
            </div>
          ) : (
            <ul>
              {visible.map((repo) => (
                <RepoRow
                  key={repo.id}
                  repo={repo}
                  verdict={verdicts[repo.fullName]}
                  selected={selected.has(repo.fullName)}
                  onSelectedChange={(next) => toggleRepo(repo.fullName, next)}
                  unstarring={inFlight.has(repo.fullName)}
                />
              ))}
            </ul>
          )}
        </div>

        {ghResults !== null && (
          <section className="rise-in mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center gap-3 border-b border-border bg-muted/50 px-4 py-2">
              <Github className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-xs text-muted-foreground">
                {ghResults.length} from GitHub
                {translatedQuery && <span className="text-faint"> · query: {translatedQuery}</span>}
              </span>
              <button
                onClick={() => setGhResults(null)}
                aria-label="Dismiss GitHub results"
                className="ml-auto cursor-pointer text-faint hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {ghResults.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                GitHub search found nothing for that description.
              </p>
            ) : (
              <ul>
                {ghResults.map((r) => {
                  const isStarred = isGhStarred(r.fullName)
                  const busy = ghBusy.has(r.fullName)
                  return (
                    <li
                      key={r.id}
                      className="group flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted/60"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <a
                            href={`/repo/${r.owner}/${r.name}`}
                            target="_blank"
                            rel="noopener"
                            className="font-mono text-sm leading-5 hover:underline"
                          >
                            <span className="text-muted-foreground">{r.owner}/</span>
                            <span className="font-semibold">{r.name}</span>
                          </a>
                          <a
                            href={r.htmlUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open ${r.fullName} on GitHub`}
                            className="text-faint opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
                          >
                            <Github className="h-3.5 w-3.5" />
                          </a>
                          {isStarred && <Badge variant="flag">starred</Badge>}
                          {r.archived && <Badge variant="red">archived</Badge>}
                        </div>
                        {r.description && (
                          <p className="mt-0.5 line-clamp-1 text-[13px] text-muted-foreground">{r.description}</p>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 font-mono text-[11px] text-faint">
                          {r.language && <span>{r.language}</span>}
                          <span className="inline-flex items-center gap-0.5">
                            <Star className="h-3 w-3" />
                            {formatCount(r.stargazersCount)}
                          </span>
                          <span>pushed {timeAgo(r.pushedAt)}</span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => void toggleGhStar(r)}
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Star className={isStarred ? 'h-3.5 w-3.5 fill-accent text-accent-strong' : 'h-3.5 w-3.5'} />
                        )}
                        {isStarred ? 'Unstar' : 'Star'}
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )}
      </main>
    </div>
  )
}
