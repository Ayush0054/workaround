import { ArrowUpRight, Github, Search, Sparkles, Star } from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { TypographyHeading } from '#/components/ui/typography'

const ERROR_MESSAGES: Record<string, string> = {
  oauth_state: 'Sign-in was interrupted — please try again.',
  oauth_failed: 'GitHub sign-in failed — please try again.',
  github_app_unsupported:
    'Workaround needs GitHub OAuth App credentials to update stars across public repositories.',
  session_expired: 'Your GitHub session expired — please sign in again.',
}

interface DashboardSignedOutProps {
  error?: string
}

const MOCK_REPOS = [
  {
    owner: 'xataio',
    name: 'client-ts',
    description: '[Deprecated] Xata Lite SDK for TypeScript and JavaScript',
    language: 'TypeScript',
    stars: '128',
    pushed: '3mo ago',
    starred: '2y ago',
    badges: ['archived', 'deprecated'],
  },
  {
    owner: 'openai',
    name: 'gpt-3',
    description: 'GPT-3: Language Models are Few-Shot Learners',
    language: null,
    stars: '16k',
    pushed: '5y ago',
    starred: '2y ago',
    badges: ['archived', 'no commits 4y+'],
  },
  {
    owner: 'streamlit',
    name: 'streamlit',
    description: 'A faster way to build and share data apps.',
    language: 'Python',
    stars: '45k',
    pushed: 'today',
    starred: '8d ago',
    badges: [],
  },
  {
    owner: 'panva',
    name: 'jose',
    description: 'JWA, JWS, JWE, JWT, JWK, and JWKS for JavaScript runtimes',
    language: 'TypeScript',
    stars: '7.7k',
    pushed: '5d ago',
    starred: '19d ago',
    badges: ['ai: keep'],
  },
] as const

export function DashboardSignedOut({ error }: DashboardSignedOutProps) {
  return (
    <>
      <div className="rise-in mb-6">
        <TypographyHeading level={1} size="xs" className="font-bold tracking-tight">
          Starred repos
        </TypographyHeading>
        <p className="mt-1 font-mono text-xs text-muted-foreground">374 starred · 4 flagged · preview</p>
      </div>

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-destructive/30 bg-destructive-soft px-3 py-2 text-sm text-destructive"
        >
          {ERROR_MESSAGES[error] ?? 'Something went wrong — please try again.'}
        </p>
      )}

      <div className="rise-in relative min-h-0 flex-1 overflow-hidden">
        <div className="flex h-full min-h-0 flex-col select-none">
          <div aria-hidden="true" className="mb-2 flex flex-wrap items-center gap-2 opacity-75">
            <div className="flex h-9 min-w-64 flex-1 items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm text-faint shadow-sm">
              <Search className="h-4 w-4" />
              Filter instantly, or describe a repo and press Enter to ask AI…
            </div>
            <div className="flex h-9 items-center rounded-lg border border-input bg-card px-3 text-sm text-muted-foreground shadow-sm">
              My stars
            </div>
          </div>

          <div
            aria-hidden="true"
            className="mb-4 flex w-fit rounded-lg border border-border bg-muted p-0.5 opacity-75"
          >
            <span className="rounded-md bg-card px-3 py-1.5 text-xs font-medium shadow-sm">All</span>
            <span className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
              Flagged <span className="ml-1 font-mono text-[10px] text-accent-strong">4</span>
            </span>
            <span className="px-3 py-1.5 text-xs font-medium text-muted-foreground">AI verdicts</span>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div aria-hidden="true" className="flex items-center gap-3 border-b border-border bg-muted/95 px-4 py-2">
              <span className="h-4 w-4 rounded border border-input bg-card" />
              <span className="font-mono text-xs text-muted-foreground">4 shown</span>
            </div>

            <ul aria-label="Preview repositories">
              {MOCK_REPOS.map((repo) => (
                <li key={`${repo.owner}/${repo.name}`} className="border-b border-border last:border-b-0">
                  <a
                    href="/api/auth/login"
                    aria-label={`Sign in to inspect ${repo.owner}/${repo.name}`}
                    className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent-soft/45 focus-visible:bg-accent-soft/45 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                  >
                    <span className="mt-0.5 h-4 w-4 shrink-0 rounded border border-input bg-card transition-colors group-hover:border-accent/40 group-hover:bg-accent-soft" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm leading-5">
                          <span className="text-muted-foreground">{repo.owner}/</span>
                          <span className="font-semibold text-foreground">{repo.name}</span>
                        </span>
                        {repo.badges.map((badge) => (
                          <Badge
                            key={badge}
                            variant={badge === 'ai: keep' ? 'green' : badge === 'no commits 4y+' ? 'flag' : 'red'}
                          >
                            {badge}
                          </Badge>
                        ))}
                      </div>
                      <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{repo.description}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 font-mono text-[11px] text-faint">
                        {repo.language && <span>{repo.language}</span>}
                        <span className="inline-flex items-center gap-0.5">
                          <Star className="h-3 w-3" />
                          {repo.stars}
                        </span>
                        <span>pushed {repo.pushed}</span>
                        <span>starred {repo.starred}</span>
                      </div>
                    </div>
                    <span className="mt-1 hidden shrink-0 items-center gap-1 rounded-md border border-border bg-card px-2 py-1 font-mono text-[10px] text-muted-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 sm:inline-flex">
                      Sign in to inspect
                      <ArrowUpRight className="h-3 w-3" />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-background via-background/95 to-transparent px-6 pt-16 pb-16">
          <div className="pointer-events-auto max-w-sm text-center">
            <TypographyHeading level={2} size="xs" className="font-bold tracking-tight">
              See what is still worth keeping
            </TypographyHeading>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Connect GitHub to load your stars and start cleaning up.
            </p>
            <a
              href="/api/auth/login"
              className="mt-4 inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Github className="h-4 w-4" />
              Continue with GitHub
            </a>
            <p className="mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] text-faint">
              <Sparkles className="h-3 w-3" />
              AI review · saved verdicts · bulk cleanup
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
