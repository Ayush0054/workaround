import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { ArrowLeft, ArrowUpRight, CircleDot, Eye, GitFork, Github, Globe, Loader2, Scale, Star } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { getAuth, getRepoInfo, star, unstar } from '#/lib/functions'
import { formatCount, timeAgo } from '#/lib/utils'

export const Route = createFileRoute('/repo/$owner/$name')({
  beforeLoad: async () => {
    const auth = await getAuth()
    if (!auth) throw redirect({ to: '/' })
  },
  loader: ({ params }) => getRepoInfo({ data: { owner: params.owner, name: params.name } }),
  component: RepoPage,
})

const YEAR_MS = 365 * 24 * 60 * 60 * 1000

function RepoPage() {
  const { repo, readmeHtml, starred: initialStarred } = Route.useLoaderData()
  const [starred, setStarred] = useState(initialStarred)
  const [busy, setBusy] = useState(false)

  const staleYears = repo.pushedAt ? Math.floor((Date.now() - Date.parse(repo.pushedAt)) / YEAR_MS) : null
  const deprecated = repo.description ? /\b(deprecated|unmaintained|no longer maintained|abandoned)\b/i.test(repo.description) : false

  async function toggleStar() {
    setBusy(true)
    try {
      const payload = { data: { owner: repo.owner, repo: repo.name } }
      if (starred) await unstar(payload)
      else await star(payload)
      setStarred(!starred)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <span className="font-syne text-sm">workaround</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pt-10 pb-16">
        <div className="rise-in">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="font-mono text-2xl leading-tight break-words">
                <span className="text-muted-foreground">{repo.owner}/</span>
                <span className="font-semibold">{repo.name}</span>
              </h1>
              {repo.description && (
                <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{repo.description}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {repo.archived && <Badge variant="red">archived</Badge>}
                {deprecated && <Badge variant="red">deprecated</Badge>}
                {staleYears !== null && staleYears >= 2 && <Badge variant="flag">no commits {staleYears}y+</Badge>}
                {repo.fork && <Badge>fork</Badge>}
                {repo.topics.slice(0, 8).map((t) => (
                  <Badge key={t}>{t}</Badge>
                ))}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button variant={starred ? 'outline' : 'default'} onClick={() => void toggleStar()} disabled={busy}>
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Star className={starred ? 'h-4 w-4 fill-accent text-accent-strong' : 'h-4 w-4'} />
                )}
                {starred ? 'Unstar' : 'Star'}
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open(repo.htmlUrl, '_blank', 'noopener,noreferrer')}
              >
                <Github className="h-4 w-4" />
                GitHub
                <ArrowUpRight className="h-3 w-3 text-faint" />
              </Button>
            </div>
          </div>

          <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
            {(
              [
                [<Star key="i" className="h-3.5 w-3.5" />, 'stars', formatCount(repo.stargazersCount)],
                [<GitFork key="i" className="h-3.5 w-3.5" />, 'forks', formatCount(repo.forksCount)],
                [<Eye key="i" className="h-3.5 w-3.5" />, 'watchers', formatCount(repo.watchersCount)],
                [<CircleDot key="i" className="h-3.5 w-3.5" />, 'open issues', formatCount(repo.openIssuesCount)],
                [<Scale key="i" className="h-3.5 w-3.5" />, 'license', repo.license ?? '—'],
                [null, 'last push', timeAgo(repo.pushedAt)],
              ] as Array<[React.ReactNode, string, string]>
            ).map(([icon, label, value]) => (
              <div key={label} className="bg-card px-4 py-3">
                <dt className="flex items-center gap-1.5 font-mono text-[11px] text-faint">
                  {icon}
                  {label}
                </dt>
                <dd className="mt-1 font-mono text-sm font-semibold">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-faint">
            {repo.language && <span>written in {repo.language}</span>}
            <span>created {timeAgo(repo.createdAt)}</span>
            {repo.homepage && (
              <a
                href={repo.homepage}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-accent-strong hover:underline"
              >
                <Globe className="h-3 w-3" />
                {repo.homepage.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>

          {readmeHtml ? (
            <section className="mt-10">
              <h2 className="font-cantarell mb-3 text-lg font-bold">README</h2>
              <article
                className="prose prose-sm max-w-none overflow-x-auto rounded-xl border border-border bg-card px-6 py-5 prose-a:text-accent-strong prose-pre:bg-muted prose-pre:text-foreground"
                dangerouslySetInnerHTML={{ __html: readmeHtml }}
              />
            </section>
          ) : (
            <p className="mt-10 rounded-xl border border-border bg-card px-6 py-8 text-center text-sm text-muted-foreground">
              This repo has no README.
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
