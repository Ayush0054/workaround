import { z } from 'zod'
import type { AiVerdict } from '#/types/ai'

export const MAX_AI_CANDIDATES = 120
export const MAX_AI_PROMPT_LENGTH = 1000
export const MAX_SEMANTIC_MATCHES = 50
export const MAX_SWEEP_TARGETS = 3000

const requiredString = z.string().trim().min(1)

export const repositoryInputSchema = z
  .object({ owner: requiredString, name: requiredString })
  .strict()

export const starInputSchema = z
  .object({ owner: requiredString, repo: requiredString })
  .strict()

export const reviewInputSchema = z
  .object({
    prompt: z.string().trim().min(1).max(MAX_AI_PROMPT_LENGTH).optional(),
  })
  .strict()

export const semanticFilterInputSchema = z
  .object({
    query: requiredString.max(MAX_AI_PROMPT_LENGTH),
  })
  .strict()

export const searchInputSchema = z
  .object({ query: requiredString.max(MAX_AI_PROMPT_LENGTH) })
  .strict()

export const sweepTargetSchema = z
  .object({
    owner: requiredString,
    name: requiredString,
    fullName: requiredString,
  })
  .strict()

export const sweepInputSchema = z
  .object({ targets: z.array(sweepTargetSchema).max(MAX_SWEEP_TARGETS) })
  .strict()
  .transform(({ targets }) => ({
    targets: [
      ...new Map(targets.map((target) => [target.fullName, target])).values(),
    ],
  }))

export const sweepStatusInputSchema = z
  .object({ jobId: requiredString })
  .strict()

export const aiVerdictSchema: z.ZodType<AiVerdict> = z
  .object({
    fullName: requiredString,
    verdict: z.enum(['unstar', 'keep', 'unsure']),
    reason: requiredString,
  })
  .strict()

export const aiVerdictResponseSchema = z
  .object({ verdicts: z.array(aiVerdictSchema) })
  .strict()

export const semanticMatchResponseSchema = z
  .object({ matches: z.array(requiredString) })
  .strict()

export const searchQueryResponseSchema = z
  .object({ q: requiredString })
  .strict()

export const cloudflareChatCompletionSchema = z
  .object({
    choices: z
      .array(
        z.object({
          message: z
            .object({
              content: z.string().nullable().optional(),
              refusal: z.string().nullable().optional(),
            })
            .optional(),
        }),
      )
      .optional(),
  })
  .passthrough()

export const githubTokenResponseSchema = z
  .object({
    access_token: z.string().optional(),
    error: z.string().optional(),
    error_description: z.string().optional(),
  })
  .passthrough()

export const githubProfileSchema = z
  .object({
    id: z.number().int().nonnegative(),
    login: requiredString,
    name: z.string().nullable(),
    email: z.string().email().nullable(),
    avatar_url: requiredString,
  })
  .passthrough()

export const githubEmailsSchema = z.array(
  z
    .object({
      email: z.string().email(),
      primary: z.boolean(),
      verified: z.boolean(),
    })
    .passthrough(),
)

const githubRepoSummarySchema = z
  .object({
    id: z.number().int().nonnegative(),
    full_name: requiredString,
    name: requiredString,
    owner: z.object({ login: requiredString }).passthrough(),
    description: z.string().nullable(),
    html_url: requiredString,
    language: z.string().nullable(),
    stargazers_count: z.number().int().nonnegative(),
    pushed_at: z.string().nullable(),
    archived: z.boolean(),
  })
  .passthrough()

export const githubStarredReposSchema = z.array(
  z
    .object({
      starred_at: requiredString,
      repo: githubRepoSummarySchema.extend({ fork: z.boolean() }),
    })
    .passthrough(),
)

export const githubRepoDetailSchema = githubRepoSummarySchema.extend({
  homepage: z.string().nullable(),
  topics: z.array(z.string()).optional(),
  license: z
    .object({ spdx_id: z.string().nullable() })
    .passthrough()
    .nullable(),
  forks_count: z.number().int().nonnegative(),
  subscribers_count: z.number().int().nonnegative(),
  open_issues_count: z.number().int().nonnegative(),
  created_at: requiredString,
  fork: z.boolean(),
})

export const githubSearchResponseSchema = z
  .object({ items: z.array(githubRepoSummarySchema) })
  .passthrough()

export const githubErrorResponseSchema = z
  .object({ message: z.string().optional() })
  .passthrough()

export type RepositoryInput = z.infer<typeof repositoryInputSchema>
export type StarInput = z.infer<typeof starInputSchema>
export type ReviewInput = z.infer<typeof reviewInputSchema>
export type SemanticFilterInput = z.infer<typeof semanticFilterInputSchema>
export type SearchInput = z.infer<typeof searchInputSchema>
export type SweepInput = z.infer<typeof sweepInputSchema>
export type SweepStatusInput = z.infer<typeof sweepStatusInputSchema>

export function parseRepositoryInput(input: unknown): RepositoryInput {
  return repositoryInputSchema.parse(input)
}

export function parseStarInput(input: unknown): StarInput {
  return starInputSchema.parse(input)
}

export function parseReviewInput(input: unknown): ReviewInput {
  return reviewInputSchema.parse(input)
}

export function parseSemanticFilterInput(input: unknown): SemanticFilterInput {
  return semanticFilterInputSchema.parse(input)
}

export function parseSearchInput(input: unknown): SearchInput {
  return searchInputSchema.parse(input)
}

export function parseSweepInput(input: unknown): SweepInput {
  return sweepInputSchema.parse(input)
}

export function parseSweepStatusInput(input: unknown): SweepStatusInput {
  return sweepStatusInputSchema.parse(input)
}
