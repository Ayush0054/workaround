import { forwardRef } from 'react'
import { cn } from '#/lib/utils'
import type { HTMLAttributes } from 'react'

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6
type HeadingSize = 'xs' | 'sm' | 'md' | 'lg'
type TextSize = 'xs' | 'sm' | 'md' | 'lg'
type TextVariant = 'body' | 'label' | 'mono'

const headingSizes: Record<HeadingSize, string> = {
  xs: 'text-base',
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-4xl sm:text-5xl',
}

const textSizes: Record<TextSize, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
}

const textVariants: Record<TextVariant, string> = {
  body: 'leading-relaxed',
  label: 'font-mono font-medium uppercase leading-4 tracking-[0.18em]',
  mono: 'font-mono leading-5',
}

export interface TypographyHeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level?: HeadingLevel
  size?: HeadingSize
}

export const TypographyHeading = forwardRef<HTMLHeadingElement, TypographyHeadingProps>(
  ({ level = 2, size = 'sm', className, ...props }, ref) => {
    const Component = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
    return <Component ref={ref} className={cn('leading-tight', headingSizes[size], className)} {...props} />
  },
)
TypographyHeading.displayName = 'TypographyHeading'

export interface TypographyTextProps extends HTMLAttributes<HTMLSpanElement> {
  size?: TextSize
  variant?: TextVariant
}

export const TypographyText = forwardRef<HTMLSpanElement, TypographyTextProps>(
  ({ size = 'sm', variant = 'body', className, ...props }, ref) => (
    <span ref={ref} className={cn(textSizes[size], textVariants[variant], className)} {...props} />
  ),
)
TypographyText.displayName = 'TypographyText'
