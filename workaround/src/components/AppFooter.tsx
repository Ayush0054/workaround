import type { HTMLAttributes } from 'react'
import { TypographyText } from '#/components/ui/typography'
import { cn } from '#/lib/utils'

export function AppFooter({ children, className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <footer className={cn('mx-auto w-full max-w-2xl px-6 pb-8', className)} {...props}>
      {children ?? (
        <TypographyText size="xs" variant="mono" className="font-syne text-[11px] text-faint">
          workaround — unstar the dead weight
        </TypographyText>
      )}
    </footer>
  )
}
