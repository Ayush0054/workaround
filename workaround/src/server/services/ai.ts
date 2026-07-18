import Anthropic from '@anthropic-ai/sdk'
import { Effect } from 'effect'
import { z } from 'zod'
import { attempt } from '#/lib/errors'
import { env } from '../env'
import {
  aiVerdictResponseSchema,
  cloudflareChatCompletionSchema,
  MAX_SEMANTIC_MATCHES,
  searchQueryResponseSchema,
  semanticMatchResponseSchema,
} from '../schemas'
import { parseJsonText } from '../utils/http'
import {
  buildReviewPrompt,
  buildSearchQueryPrompt,
  buildSemanticMatchPrompt,
} from '../utils/prompts'
import type { AiVerdict, CandidatePayload, CompactRepo } from '#/types/ai'

export function aiConfigured(): boolean {
  return cloudflareAiConfigured() || Boolean(env.ANTHROPIC_API_KEY)
}

function cloudflareAiConfigured(): boolean {
  return Boolean(
    env.CLOUDFLARE_AI_GATEWAY_URL &&
    env.CLOUDFLARE_AI_API_TOKEN &&
    env.CLOUDFLARE_AI_MODEL,
  )
}

interface JsonRequest<T> {
  responseSchema: z.ZodType<T>
  system: string
  user: string
  maxTokens: number
}

interface CloudflareJsonRequest<T> extends JsonRequest<T> {
  schemaName: string
}

interface StructuredJsonRequest<T> extends CloudflareJsonRequest<T> {
  fallbackSystem?: string
}

async function createCloudflareJson<T>({
  schemaName,
  responseSchema,
  system,
  user,
  maxTokens,
}: CloudflareJsonRequest<T>): Promise<T | null> {
  const gatewayUrl = env.CLOUDFLARE_AI_GATEWAY_URL
  const token = env.CLOUDFLARE_AI_API_TOKEN
  const model = env.CLOUDFLARE_AI_MODEL
  if (!gatewayUrl || !token || !model) return null

  const response = await fetch(gatewayUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'cf-aig-gateway-id': env.CLOUDFLARE_AI_GATEWAY_ID || 'default',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_completion_tokens: maxTokens,
      reasoning_effort: 'low',
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: schemaName,
          strict: true,
          schema: z.toJSONSchema(responseSchema),
        },
      },
    }),
  })

  const body = await response.text()
  if (!response.ok) {
    throw new Error(
      `Cloudflare AI request failed (${response.status}): ${body.slice(0, 500)}`,
    )
  }

  const completion = parseJsonText(body, cloudflareChatCompletionSchema)
  const message = completion.choices?.[0]?.message
  if (message?.refusal || !message?.content) return null
  return parseJsonText(message.content, responseSchema)
}

function createAiClient(): Anthropic {
  return new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    baseURL: env.AI_GATEWAY_URL || undefined,
  })
}

function aiModel(): string {
  return env.AI_MODEL || 'claude-opus-4-8'
}

async function createAnthropicJson<T>({
  responseSchema,
  system,
  user,
  maxTokens,
}: JsonRequest<T>): Promise<T | null> {
  const response = await createAiClient().messages.create({
    model: aiModel(),
    max_tokens: maxTokens,
    thinking: { type: 'adaptive' },
    output_config: {
      format: {
        type: 'json_schema',
        schema: z.toJSONSchema(responseSchema),
      },
    },
    system,
    messages: [{ role: 'user', content: user }],
  })

  if (response.stop_reason === 'refusal') return null
  const text = response.content.find((block) => block.type === 'text')?.text
  return text ? parseJsonText(text, responseSchema) : null
}

async function createStructuredJson<T>({
  schemaName,
  responseSchema,
  system,
  fallbackSystem,
  user,
  maxTokens,
}: StructuredJsonRequest<T>): Promise<T | null> {
  const anthropicRequest = {
    responseSchema,
    system: fallbackSystem ?? system,
    user,
    maxTokens,
  }

  if (!cloudflareAiConfigured()) {
    return env.ANTHROPIC_API_KEY ? createAnthropicJson(anthropicRequest) : null
  }

  const cloudflare = attempt(
    () =>
      createCloudflareJson({
        schemaName,
        responseSchema,
        system,
        user,
        maxTokens,
      }),
    'Cloudflare AI generation failed',
  )

  if (!env.ANTHROPIC_API_KEY) return Effect.runPromise(cloudflare)

  return Effect.runPromise(
    cloudflare.pipe(
      Effect.catchAll(() =>
        attempt(
          () => createAnthropicJson(anthropicRequest),
          'Anthropic fallback generation failed',
        ),
      ),
    ),
  )
}

/**
 * Asks the configured AI provider for a keep/unstar verdict per candidate.
 * Cloudflare AI Gateway is preferred, with Anthropic retained as a fallback.
 */
export async function aiReview(
  candidates: CandidatePayload[],
  customPrompt?: string,
): Promise<AiVerdict[]> {
  if (candidates.length === 0) return []

  const prompt = buildReviewPrompt(candidates, customPrompt)
  const parsed = await createStructuredJson({
    schemaName: 'github_star_verdicts',
    responseSchema: aiVerdictResponseSchema,
    ...prompt,
    maxTokens: 16000,
  })
  return parsed?.verdicts ?? []
}

/** Returns matching fullNames, best match first. */
export async function semanticMatch(
  query: string,
  repos: CompactRepo[],
): Promise<string[]> {
  if (!aiConfigured()) throw new Error('AI is not configured')
  if (repos.length === 0) return []

  const prompt = buildSemanticMatchPrompt(query, repos)
  const parsed = await createStructuredJson({
    schemaName: 'github_repository_matches',
    responseSchema: semanticMatchResponseSchema,
    ...prompt,
    maxTokens: 16000,
  })

  const known = new Set(repos.map((repo) => repo.fullName))
  return (parsed?.matches ?? [])
    .filter((match) => known.has(match))
    .slice(0, MAX_SEMANTIC_MATCHES)
}

/** Translates natural language into a GitHub repository search query. */
export async function toSearchQuery(query: string): Promise<string> {
  if (!aiConfigured()) return query

  const prompt = buildSearchQueryPrompt(query)
  const parsed = await createStructuredJson({
    schemaName: 'github_search_query',
    responseSchema: searchQueryResponseSchema,
    ...prompt,
    fallbackSystem: buildSearchQueryPrompt(query, true).system,
    maxTokens: 1000,
  })

  return parsed?.q || query
}
