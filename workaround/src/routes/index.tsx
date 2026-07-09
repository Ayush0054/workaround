import { createFileRoute, redirect } from '@tanstack/react-router'
import { Github, Sparkles, Star } from 'lucide-react'
import { getAuth } from '#/lib/functions'

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): { error?: string } => ({
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  beforeLoad: async () => {
    const auth = await getAuth()
    if (auth) throw redirect({ to: '/dashboard' })
  },
  component: Landing,
})

const ERROR_MESSAGES: Record<string, string> = {
  oauth_state: 'Sign-in was interrupted — please try again.',
  oauth_failed: 'GitHub sign-in failed — please try again.',
}

function Landing() {
  const { error } = Route.useSearch()

  return (
    <main className="flex min-h-dvh flex-col">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-16">
        <div className="rise-in">
          <div className="mb-8 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-accent/40 bg-accent-soft shadow-sm">
            <Star className="h-5 w-5 fill-accent text-accent-strong" />
          </div>

          <h1 className="font-cantarell max-w-xl text-4xl leading-[1.08] font-bold tracking-tight sm:text-5xl">
            Your stars deserve
            <br />a spring clean.
          </h1>

          <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground">
            Workaround lists every repo you've starred, flags the archived and abandoned ones, and lets AI argue about
            the rest — then unstars them in one sweep.
          </p>

          {error && (
            <p className="mt-5 rounded-lg border border-destructive/30 bg-destructive-soft px-3 py-2 text-sm text-destructive">
              {ERROR_MESSAGES[error] ?? 'Something went wrong — please try again.'}
            </p>
          )}

          <div className="mt-8">
            <a
              href="/api/auth/login"
              className="inline-flex h-11 items-center gap-2.5 rounded-xl bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              <Github className="h-4 w-4" />
              Continue with GitHub
            </a>
          </div>

          <ul className="mt-12 space-y-3.5 border-t border-border pt-8 text-sm leading-relaxed text-muted-foreground">
            <li className="flex items-start gap-2.5">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" />
              <span>
                <span className="font-medium text-foreground">Finds the dead weight.</span> Archived, deprecated,
                and years-untouched repos are flagged the moment you sign in.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Star className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" />
              <span>
                <span className="font-medium text-foreground">AI helps you decide.</span> Every flagged repo gets a
                keep-or-unstar verdict with a one-line reason.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Github className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" />
              <span>
                <span className="font-medium text-foreground">Touches nothing but your stars.</span> One narrow
                GitHub permission, and nothing gets stored — sign out and it's gone.
              </span>
            </li>
          </ul>
        </div>
      </div>

      <footer className="mx-auto w-full max-w-2xl px-6 pb-8">
        <p className="font-syne text-[11px] text-faint">workaround — unstar the dead weight</p>
      </footer>
    </main>
  )
}
