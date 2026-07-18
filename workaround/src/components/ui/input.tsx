import { cn } from '#/lib/utils'
import type { InputHTMLAttributes } from 'react'

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-9 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-sm transition-colors',
        'placeholder:text-faint',
        'focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring/40',
        className,
      )}
      {...props}
    />
  )
}
