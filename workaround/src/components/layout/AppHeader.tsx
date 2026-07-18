import type { HTMLAttributes } from 'react'
import { cn } from '#/lib/utils'

export interface AppHeaderProps extends HTMLAttributes<HTMLElement> {
  contentClassName?: string
}

export function AppHeader({
  children,
  className,
  contentClassName,
  ...props
}: AppHeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-10 shrink-0 border-b border-border bg-background/90 backdrop-blur',
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          'mx-auto flex h-14 max-w-5xl items-center justify-between px-4',
          contentClassName,
        )}
      >
        {children}
      </div>
    </header>
  )
}

export function AppWordmark({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn('font-syne', className)} {...props}>
      workaround
    </span>
  )
}
