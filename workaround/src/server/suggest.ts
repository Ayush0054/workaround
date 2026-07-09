import Anthropic from '@anthropic-ai/sdk'
import { env } from './env'
import type { StarredRepo } from './github'

export type Signal = 'archived' | 'deprecated' | 'stale' | 'very-stale' | 'old-star'

export type ScoredRepo = StarredRepo & {
  score: number
  signals: Signal[]
}

const YEAR_MS = 365 * 24 * 60 * 60 * 1000
const DEPRECATED_RE = /\b(deprecated|unmaintained|no longer maintained|abandoned|archived|moved to|superseded by)\b/i

/**
 * Deterministic signals — free to compute, no AI needed.
 * The LLM pass only runs on repos these surface plus anything the user selects.
 */
export function scoreRepo(repo: StarredRepo, now = Date.now()): ScoredRepo {
  const signals: Signal[] = []
  let score = 0

  if (repo.archived) {
    signals.push('archived')
    score += 50
  }
  if (repo.description && DEPRECATED_RE.test(repo.description)) {
    signals.push('deprecated')
    score += 40
  }
  if (repo.pushedAt) {
    const age = now - Date.parse(repo.pushedAt)
    if (age > 4 * YEAR_MS) {
      signals.push('very-stale')
      score += 35
    } else if (age > 2 * YEAR_MS) {
      signals.push('stale')
      score += 20
    }
  }
  if (now - Date.parse(repo.starredAt) > 3 * YEAR_MS) {
    signals.push('old-star')
    score += 15
  }

  return { ...repo, score, signals }
}

export function scoreRepos(repos: StarredRepo[]): ScoredRepo[] {
  const now = Date.now()
  return repos.map((r) => scoreRepo(r, now))
}

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
  return Boolean(env.ANTHROPIC_API_KEY)
}

/**
 * Asks Claude (via Cloudflare AI Gateway when AI_GATEWAY_URL is set) for a
 * keep/unstar verdict per candidate. Returns [] when no API key is configured
 * so the app degrades to heuristics-only.
 */
export async function aiReview(candidates: CandidatePayload[]): Promise<AiVerdict[]> {
  if (!env.ANTHROPIC_API_KEY || candidates.length === 0) return []

  const client = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    baseURL: env.AI_GATEWAY_URL || undefined,
  })

  const response = await client.messages.create({
    model: env.AI_MODEL || 'claude-opus-4-8',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: {
      format: { type: 'json_schema', schema: VERDICT_SCHEMA },
    },
    system:
      'You review a GitHub user\'s starred repositories and recommend which ones to unstar. ' +
      'Recommend "unstar" for repos that are archived, deprecated, superseded by a clearly better successor, or long-dead experiments. ' +
      'Recommend "keep" for foundational or still-useful projects even if they change rarely (stable ≠ dead: specs, algorithms, references, and finished tools stay valuable). ' +
      'Use "unsure" when the metadata is not enough to decide. ' +
      'Reasons must be one short sentence, specific to the repo (name a successor when relevant), never generic filler. ' +
      'Return one verdict per input repo, matching fullName exactly.',
    messages: [
      {
        role: 'user',
        content:
          `Today is ${new Date().toISOString().slice(0, 10)}. Review these ${candidates.length} starred repos:\n\n` +
          JSON.stringify(candidates),
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
  if (!env.ANTHROPIC_API_KEY) throw new Error('AI is not configured (set ANTHROPIC_API_KEY)')
  if (repos.length === 0) return []

  const client = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    baseURL: env.AI_GATEWAY_URL || undefined,
  })

  const catalog = repos
    .map((r) => `${r.fullName} | ${r.language ?? '-'} | ${(r.description ?? '').slice(0, 140)}`)
    .join('\n')

  const response = await client.messages.create({
    model: env.AI_MODEL || 'claude-opus-4-8',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { format: { type: 'json_schema', schema: MATCH_SCHEMA } },
    system:
      'You match GitHub repositories against a natural-language description. ' +
      'The user message contains the description and a catalog of repos (one per line: fullName | language | description). ' +
      'Return the fullNames of repos that genuinely match the description, best match first, at most 50. ' +
      'Match on purpose and capability, not keyword overlap. Return an empty list if nothing matches.',
    messages: [
      {
        role: 'user',
        content: `Description: ${query}\n\nCatalog:\n${catalog}`,
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
  if (!env.ANTHROPIC_API_KEY) return query

  const client = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    baseURL: env.AI_GATEWAY_URL || undefined,
  })

  const response = await client.messages.create({
    model: env.AI_MODEL || 'claude-opus-4-8',
    max_tokens: 1000,
    thinking: { type: 'adaptive' },
    output_config: { format: { type: 'json_schema', schema: QUERY_SCHEMA } },
    system:
      'Convert a natural-language description of a repository into a GitHub repository search query string. ' +
      'Use search qualifiers where they help: language:, topic:, stars:>N, in:name,description,readme. ' +
      'Keep the free-text part to the 2-4 most distinctive terms. Return only the query string.',
    messages: [{ role: 'user', content: query }],
  })

  if (response.stop_reason === 'refusal') return query
  const text = response.content.find((b) => b.type === 'text')?.text
  if (!text) return query
  const parsed = JSON.parse(text) as { q: string }
  return parsed.q || query
}
