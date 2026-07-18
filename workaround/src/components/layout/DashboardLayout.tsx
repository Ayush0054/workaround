import { AppHeader, AppWordmark } from '#/components/layout'
import { Button } from '#/components/ui/button'

interface DashboardLayoutProps {
  user: {
    login: string
    avatarUrl: string
  }
  children: React.ReactNode
}

export function DashboardLayout({ user, children }: DashboardLayoutProps) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <AppHeader>
        <AppWordmark className="text-lg tracking-tight" />
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {user.avatarUrl && (
              <img
                src={user.avatarUrl}
                alt=""
                className="h-6 w-6 rounded-full border border-border"
              />
            )}
            <span className="font-mono text-xs text-muted-foreground">
              {user.login}
            </span>
          </div>
          <form action="/api/auth/logout" method="post">
            <Button variant="ghost" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </AppHeader>

      <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-hidden px-4 pb-4">
        {children}
      </main>
    </div>
  )
}
