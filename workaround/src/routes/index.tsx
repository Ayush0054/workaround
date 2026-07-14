import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): { error?: string } => ({
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: '/dashboard',
      search: search.error ? { error: search.error } : {},
    })
  },
})
