import type { z } from 'zod'
import type {
  dashboardFilterSchema,
  searchScopeSchema,
} from '#/schemas/dashboard'
import type { StarredRepositories } from '#/types/stars'

export type DashboardFilter = z.infer<typeof dashboardFilterSchema>
export type SearchScope = z.infer<typeof searchScopeSchema>

export interface DashboardAuth {
  login: string
  name: string | null
  email: string | null
  avatarUrl: string
}

export interface DashboardPageProps {
  auth: DashboardAuth
  repositories: StarredRepositories
}

export interface DashboardTab {
  value: DashboardFilter
  label: string
  count: number | null
}
