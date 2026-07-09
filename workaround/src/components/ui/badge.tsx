import { cn } from '#/lib/utils'
import type { HTMLAttributes } from 'react'

type Variant = 'neutral' | 'flag' | 'red' | 'green'

const variants: Record<Variant, string> = {
  neutral: 'bg-muted text-muted-foreground',
  flag: 'bg-accent-soft text-accent-strong',
  red: 'bg-destructive-soft text-destructive',
  green: 'bg-keep-soft text-keep',
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant
}

export function Badge({ className, variant = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] leading-4 whitespace-nowrap',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
