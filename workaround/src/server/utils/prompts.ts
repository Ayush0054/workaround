import type { CandidatePayload, CompactRepo } from '#/types/ai'

interface AiPrompt {
  system: string
  user: string
}

const REVIEW_SYSTEM_PROMPT =
  "You review a GitHub user's starred repositories and recommend which ones to unstar. " +
  'Recommend "unstar" for repos that are archived, deprecated, superseded by a clearly better successor, or long-dead experiments. ' +
  'Recommend "keep" for foundational or still-useful projects even if they change rarely (stable does not mean dead: specs, algorithms, references, and finished tools stay valuable). ' +
  'Use "unsure" when the metadata is not enough to decide. ' +
  'Reasons must be one short sentence, specific to the repo (name a successor when relevant), never generic filler. ' +
  'Return one verdict per input repo, matching fullName exactly.'

const SEMANTIC_MATCH_SYSTEM_PROMPT =
  'You match GitHub repositories against a natural-language description. ' +
  'The user message contains the description and a catalog of repos with their available metadata. ' +
  'Return the fullNames of repos that genuinely match the description, best match first, at most 50. ' +
  'Match on purpose, capability, and any criteria in the description rather than keyword overlap. Return an empty list if nothing matches.'

const SEARCH_QUERY_SYSTEM_PROMPT =
  'Convert a natural-language description of a repository into a GitHub repository search query string. ' +
  'Use search qualifiers where they help: language:, topic:, stars:>N, in:name,description,readme. ' +
  'Keep the free-text part to the 2-4 most distinctive terms.'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function buildReviewPrompt(
  candidates: CandidatePayload[],
  customPrompt?: string,
): AiPrompt {
  const guidance = customPrompt
    ? `User review instructions: ${customPrompt}\n\n`
    : ''

  return {
    system: REVIEW_SYSTEM_PROMPT,
    user:
      guidance +
      `Today is ${today()}. Review these ${candidates.length} starred repos:\n\n` +
      JSON.stringify(candidates),
  }
}

export function buildSemanticMatchPrompt(
  query: string,
  repos: CompactRepo[],
): AiPrompt {
  const catalog = repos
    .map((repo) =>
      [
        repo.fullName,
        repo.language ?? '-',
        (repo.description ?? '').slice(0, 140),
        repo.pushedAt ? `pushed ${repo.pushedAt}` : null,
        repo.starredAt ? `starred ${repo.starredAt}` : null,
        repo.archived ? 'archived' : null,
        repo.signals?.length ? `signals: ${repo.signals.join(', ')}` : null,
      ]
        .filter((value): value is string => value !== null)
        .join(' | '),
    )
    .join('\n')

  return {
    system: SEMANTIC_MATCH_SYSTEM_PROMPT,
    user: `Today is ${today()}.\nDescription: ${query}\n\nCatalog:\n${catalog}`,
  }
}

export function buildSearchQueryPrompt(
  query: string,
  plainTextOnly = false,
): AiPrompt {
  return {
    system: plainTextOnly
      ? `${SEARCH_QUERY_SYSTEM_PROMPT} Return only the query string.`
      : SEARCH_QUERY_SYSTEM_PROMPT,
    user: query,
  }
}
