import { cn } from '#/lib/utils'
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'default' | 'outline' | 'ghost' | 'destructive' | 'accent'
type Size = 'default' | 'sm' | 'icon'

const variants: Record<Variant, string> = {
  default: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
  outline: 'border border-input bg-card shadow-sm hover:bg-muted',
  ghost: 'hover:bg-muted',
  destructive: 'bg-destructive text-white shadow-sm hover:bg-destructive/90',
  accent:
    'bg-accent-soft text-accent-strong border border-accent/40 shadow-sm hover:border-accent/70',
}

const sizes: Record<Size, string> = {
  default: 'h-9 px-4 text-sm',
  sm: 'h-8 px-3 text-xs',
  icon: 'h-8 w-8',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
}
