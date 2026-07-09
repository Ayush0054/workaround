import { Check, Minus } from 'lucide-react'
import { cn } from '#/lib/utils'

export interface CheckboxProps {
  checked: boolean | 'indeterminate'
  onCheckedChange: (checked: boolean) => void
  'aria-label'?: string
  className?: string
}

export function Checkbox({ checked, onCheckedChange, className, ...props }: CheckboxProps) {
  const isChecked = checked === true
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked === 'indeterminate' ? 'mixed' : isChecked}
      onClick={(e) => {
        e.stopPropagation()
        onCheckedChange(!isChecked)
      }}
      className={cn(
        'flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded border transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        checked !== false
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-input bg-card hover:border-primary/50',
        className,
      )}
      {...props}
    >
      {checked === 'indeterminate' ? (
        <Minus className="h-3 w-3" strokeWidth={3} />
      ) : isChecked ? (
        <Check className="h-3 w-3" strokeWidth={3} />
      ) : null}
    </button>
  )
}
