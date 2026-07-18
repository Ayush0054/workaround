import { AppHeader, AppWordmark } from '#/components/layout'

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <AppHeader>
        <a href="/" aria-label="Workaround home">
          <AppWordmark className="text-lg tracking-tight" />
        </a>
      </AppHeader>
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  )
}
