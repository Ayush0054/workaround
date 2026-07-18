import { z } from 'zod'

export const dashboardFilterSchema = z.enum(['all', 'flagged', 'ai', 'nlp'])
export const searchScopeSchema = z.enum(['starred', 'github', 'both'])

export const dashboardSearchSchema = z.object({
  query: z.string().trim().min(1).max(1000),
  scope: searchScopeSchema,
})

export const customReviewPromptSchema = z.string().trim().min(1).max(1000)
