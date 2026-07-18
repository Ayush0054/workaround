import { aiReview, semanticMatch } from './ai'
import { loadStarCatalog } from './repositories'
import { saveAiVerdicts } from './verdicts'
import { trackEvent } from './analytics'
import { buildAiCandidates } from '../utils/repositories'
import type { ReviewInput, SemanticFilterInput } from '../schemas'

export async function reviewRepositories({ prompt }: ReviewInput) {
  const catalog = await loadStarCatalog()
  let reviewRepos = catalog.repos.filter((repo) => repo.signals.length > 0)
  let matches: string[] | undefined

  if (prompt) {
    matches = await semanticMatch(prompt, catalog.repos)
    const matchingNames = new Set(matches)
    reviewRepos = catalog.repos.filter((repo) =>
      matchingNames.has(repo.fullName),
    )
  }

  const candidates = buildAiCandidates(reviewRepos)
  const verdicts = await aiReview(candidates, prompt)
  await saveAiVerdicts(catalog.login, verdicts)
  trackEvent({
    name: 'ai_review',
    dimension: prompt ? 'custom' : 'default',
    value: verdicts.length,
  })
  return { verdicts, analyzed: candidates.length, matches: matches ?? null }
}

export async function filterStarredRepositories({
  query,
}: SemanticFilterInput) {
  const catalog = await loadStarCatalog()
  return { matches: await semanticMatch(query, catalog.repos) }
}
