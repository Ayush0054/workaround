import Anthropic from '@anthropic-ai/sdk'
import { env } from './env'
import type { Signal } from '#/lib/repo-scoring'

export type AiVerdict = {
  fullName: string
  verdict: 'unstar' | 'keep' | 'unsure'
  reason: string
}

export type CandidatePayload = {
  fullName: string
  description: string | null
  language: string | null
  stargazersCount: number
  pushedAt: string | null
  starredAt: string
  archived: boolean
  signals: Signal[]
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fullName: { type: 'string' },
          verdict: { type: 'string', enum: ['unstar', 'keep', 'unsure'] },
          reason: { type: 'string' },
        },
        required: ['fullName', 'verdict', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['verdicts'],
  additionalProperties: false,
} as const

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

type CloudflareJsonRequest = {
  schemaName: string
  schema: object
  system: string
  user: string
  maxTokens: number
}

type CloudflareChatCompletion = {
  choices?: Array<{
    message?: {
      content?: string | null
      refusal?: string | null
    }
  }>
}

async function createCloudflareJson<T>({
  schemaName,
  schema,
  system,
  user,
  maxTokens,
}: CloudflareJsonRequest): Promise<T | null> {
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
          schema,
        },
      },
    }),
  })

  const body = await response.text()
  if (!response.ok) {
    throw new Error(`Cloudflare AI request failed (${response.status}): ${body.slice(0, 500)}`)
  }

  const completion = JSON.parse(body) as CloudflareChatCompletion
  const message = completion.choices?.[0]?.message
  if (message?.refusal || !message?.content) return null
  return JSON.parse(message.content) as T
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

/**
 * Asks the configured AI provider for a keep/unstar verdict per candidate.
 * Cloudflare AI Gateway is preferred, with Anthropic retained as a fallback.
 */
export async function aiReview(candidates: CandidatePayload[]): Promise<AiVerdict[]> {
  if (candidates.length === 0) return []

  const system =
    'You review a GitHub user\'s starred repositories and recommend which ones to unstar. ' +
    'Recommend "unstar" for repos that are archived, deprecated, superseded by a clearly better successor, or long-dead experiments. ' +
    'Recommend "keep" for foundational or still-useful projects even if they change rarely (stable ≠ dead: specs, algorithms, references, and finished tools stay valuable). ' +
    'Use "unsure" when the metadata is not enough to decide. ' +
    'Reasons must be one short sentence, specific to the repo (name a successor when relevant), never generic filler. ' +
    'Return one verdict per input repo, matching fullName exactly.'
  const user =
    `Today is ${new Date().toISOString().slice(0, 10)}. Review these ${candidates.length} starred repos:\n\n` +
    JSON.stringify(candidates)

  if (cloudflareAiConfigured()) {
    const parsed = await createCloudflareJson<{ verdicts: AiVerdict[] }>({
      schemaName: 'github_star_verdicts',
      schema: VERDICT_SCHEMA,
      system,
      user,
      maxTokens: 16000,
    })
    return parsed?.verdicts ?? []
  }

  if (!env.ANTHROPIC_API_KEY) return []

  const response = await createAiClient().messages.create({
    model: aiModel(),
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: {
      format: { type: 'json_schema', schema: VERDICT_SCHEMA },
    },
    system,
    messages: [
      {
        role: 'user',
        content: user,
      },
    ],
  })

  if (response.stop_reason === 'refusal') return []

  const text = response.content.find((b) => b.type === 'text')?.text
  if (!text) return []
  const parsed = JSON.parse(text) as { verdicts: AiVerdict[] }
  return parsed.verdicts
}

export type CompactRepo = {
  fullName: string
  description: string | null
  language: string | null
}

const MATCH_SCHEMA = {
  type: 'object',
  properties: {
    matches: { type: 'array', items: { type: 'string' } },
  },
  required: ['matches'],
  additionalProperties: false,
} as const

/**
 * Semantic filter over the user's starred repos: given a natural-language
 * description, returns matching fullNames, best match first.
 */
export async function semanticMatch(query: string, repos: CompactRepo[]): Promise<string[]> {
  if (!aiConfigured()) throw new Error('AI is not configured')
  if (repos.length === 0) return []

  const catalog = repos
    .map((r) => `${r.fullName} | ${r.language ?? '-'} | ${(r.description ?? '').slice(0, 140)}`)
    .join('\n')

  const system =
    'You match GitHub repositories against a natural-language description. ' +
    'The user message contains the description and a catalog of repos (one per line: fullName | language | description). ' +
    'Return the fullNames of repos that genuinely match the description, best match first, at most 50. ' +
    'Match on purpose and capability, not keyword overlap. Return an empty list if nothing matches.'
  const user = `Description: ${query}\n\nCatalog:\n${catalog}`

  if (cloudflareAiConfigured()) {
    const parsed = await createCloudflareJson<{ matches: string[] }>({
      schemaName: 'github_repository_matches',
      schema: MATCH_SCHEMA,
      system,
      user,
      maxTokens: 16000,
    })
    const known = new Set(repos.map((repo) => repo.fullName))
    return (parsed?.matches ?? []).filter((match) => known.has(match))
  }

  const response = await createAiClient().messages.create({
    model: aiModel(),
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { format: { type: 'json_schema', schema: MATCH_SCHEMA } },
    system,
    messages: [
      {
        role: 'user',
        content: user,
      },
    ],
  })

  if (response.stop_reason === 'refusal') return []
  const text = response.content.find((b) => b.type === 'text')?.text
  if (!text) return []
  const parsed = JSON.parse(text) as { matches: string[] }
  const known = new Set(repos.map((r) => r.fullName))
  return parsed.matches.filter((m) => known.has(m))
}

const QUERY_SCHEMA = {
  type: 'object',
  properties: {
    q: { type: 'string' },
  },
  required: ['q'],
  additionalProperties: false,
} as const

/**
 * Translates a natural-language description into a GitHub repository search
 * query string. Falls back to the raw text when AI is not configured.
 */
export async function toSearchQuery(query: string): Promise<string> {
  if (!aiConfigured()) return query

  const system =
    'Convert a natural-language description of a repository into a GitHub repository search query string. ' +
    'Use search qualifiers where they help: language:, topic:, stars:>N, in:name,description,readme. ' +
    'Keep the free-text part to the 2-4 most distinctive terms.'

  if (cloudflareAiConfigured()) {
    const parsed = await createCloudflareJson<{ q: string }>({
      schemaName: 'github_search_query',
      schema: QUERY_SCHEMA,
      system,
      user: query,
      maxTokens: 1000,
    })
    return parsed?.q || query
  }

  const response = await createAiClient().messages.create({
    model: aiModel(),
    max_tokens: 1000,
    thinking: { type: 'adaptive' },
    output_config: { format: { type: 'json_schema', schema: QUERY_SCHEMA } },
    system: `${system} Return only the query string.`,
    messages: [{ role: 'user', content: query }],
  })

  if (response.stop_reason === 'refusal') return query
  const text = response.content.find((b) => b.type === 'text')?.text
  if (!text) return query
  const parsed = JSON.parse(text) as { q: string }
  return parsed.q || query
}
