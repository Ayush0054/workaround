import { ChevronDown, Loader2, MessageSquareText, Sparkles } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'
import { customReviewPromptSchema } from '#/schemas/dashboard'

const MAX_PROMPT_LENGTH = 1000

interface AiReviewActionProps {
  analyzing: boolean
  disabled: boolean
  label: string
  title?: string
  variant?: 'outline' | 'accent'
  className?: string
  onAnalyze: (prompt?: string) => void
}

export function AiReviewAction({
  analyzing,
  disabled,
  label,
  title,
  variant = 'outline',
  className,
  onAnalyze,
}: AiReviewActionProps) {
  const [open, setOpen] = useState(false)
  const [customizing, setCustomizing] = useState(false)
  const [prompt, setPrompt] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const panelId = useId()

  function focusTrigger() {
    containerRef.current
      ?.querySelector<HTMLButtonElement>('[data-ai-review-trigger]')
      ?.focus()
  }

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        setOpen(false)
        setCustomizing(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      setCustomizing(false)
      focusTrigger()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (customizing) promptRef.current?.focus()
  }, [customizing])

  function runReview(customPrompt?: string) {
    setOpen(false)
    setCustomizing(false)
    onAnalyze(customPrompt)
    focusTrigger()
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <Button
        data-ai-review-trigger
        variant={variant}
        size="sm"
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen((current) => !current)
          setCustomizing(false)
        }}
        disabled={disabled || analyzing}
        title={title}
      >
        {analyzing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        {analyzing ? 'Reviewing…' : label}
        {!analyzing && <ChevronDown className="h-3.5 w-3.5 text-faint" />}
      </Button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Choose AI review type"
          className="absolute right-0 top-full z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card p-1.5 shadow-lg"
        >
          {customizing ? (
            <form
              className="p-2"
              onSubmit={(event) => {
                event.preventDefault()
                const result = customReviewPromptSchema.safeParse(prompt)
                if (result.success) runReview(result.data)
              }}
            >
              <label
                htmlFor={`${panelId}-prompt`}
                className="text-sm font-medium text-foreground"
              >
                Which repositories should AI review?
              </label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Describe what to find across all of your stars.
              </p>
              <textarea
                ref={promptRef}
                id={`${panelId}-prompt`}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                maxLength={MAX_PROMPT_LENGTH}
                rows={4}
                placeholder="For example: Chat apps, old Python experiments, or archived developer tools."
                className="mt-3 w-full resize-none rounded-lg border border-input bg-card px-3 py-2 text-sm leading-relaxed shadow-sm placeholder:text-faint focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring/40"
              />
              <div className="mt-3 flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCustomizing(false)}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!customReviewPromptSchema.safeParse(prompt).success}
                >
                  Run custom review
                </Button>
              </div>
            </form>
          ) : (
            <div className="grid gap-1">
              <button
                type="button"
                className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                onClick={() => runReview()}
              >
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" />
                <span>
                  <span className="block text-sm font-medium text-foreground">
                    Default AI review
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                    Use the same keep, unstar, and unsure criteria.
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                onClick={() => setCustomizing(true)}
              >
                <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" />
                <span>
                  <span className="block text-sm font-medium text-foreground">
                    Use a custom prompt
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                    Find repositories across all your stars, then review them.
                  </span>
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
