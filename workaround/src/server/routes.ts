import { createServerFn } from '@tanstack/react-start'
import {
  parseRepositoryInput,
  parseReviewInput,
  parseSearchInput,
  parseSemanticFilterInput,
  parseStarInput,
  parseSweepInput,
  parseSweepStatusInput,
} from './schemas'
import { getAuthProfile } from './services/auth'
import {
  getRepositoryInfo,
  getStarredRepositories,
  searchGitHubRepositories,
  starRepository,
  unstarRepository,
} from './services/repositories'
import {
  filterStarredRepositories,
  reviewRepositories,
} from './services/reviews'
import {
  getActiveSweepsForCurrentUser,
  getSweepStatusForCurrentUser,
  startSweepForCurrentUser,
} from './services/sweep'

export const getAuth = createServerFn({ method: 'GET' }).handler(getAuthProfile)

export const getStars = createServerFn({ method: 'GET' }).handler(
  getStarredRepositories,
)

export const startSweep = createServerFn({ method: 'POST' })
  .validator(parseSweepInput)
  .handler(({ data }) => startSweepForCurrentUser(data.targets))

export const getSweepStatus = createServerFn({ method: 'GET' })
  .validator(parseSweepStatusInput)
  .handler(({ data }) => getSweepStatusForCurrentUser(data.jobId))

export const getActiveSweeps = createServerFn({ method: 'GET' }).handler(
  getActiveSweepsForCurrentUser,
)

export const unstar = createServerFn({ method: 'POST' })
  .validator(parseStarInput)
  .handler(({ data }) => unstarRepository(data))

export const star = createServerFn({ method: 'POST' })
  .validator(parseStarInput)
  .handler(({ data }) => starRepository(data))

export const analyzeStars = createServerFn({ method: 'POST' })
  .validator(parseReviewInput)
  .handler(({ data }) => reviewRepositories(data))

export const semanticFilterStars = createServerFn({ method: 'POST' })
  .validator(parseSemanticFilterInput)
  .handler(({ data }) => filterStarredRepositories(data))

export const searchGithub = createServerFn({ method: 'POST' })
  .validator(parseSearchInput)
  .handler(({ data }) => searchGitHubRepositories(data.query))

export const getRepoInfo = createServerFn({ method: 'GET' })
  .validator(parseRepositoryInput)
  .handler(({ data }) => getRepositoryInfo(data))
