export interface GitHubViewer {
  id: number
  login: string
  name: string | null
  email: string | null
  avatarUrl: string
}

export interface StarredRepo {
  id: number
  fullName: string
  owner: string
  name: string
  description: string | null
  htmlUrl: string
  language: string | null
  stargazersCount: number
  pushedAt: string | null
  archived: boolean
  fork: boolean
  starredAt: string
}

export interface RepoDetail {
  fullName: string
  owner: string
  name: string
  description: string | null
  htmlUrl: string
  homepage: string | null
  language: string | null
  topics: string[]
  license: string | null
  stargazersCount: number
  forksCount: number
  watchersCount: number
  openIssuesCount: number
  createdAt: string
  pushedAt: string | null
  archived: boolean
  fork: boolean
}

export interface SearchResult {
  id: number
  fullName: string
  owner: string
  name: string
  description: string | null
  htmlUrl: string
  language: string | null
  stargazersCount: number
  pushedAt: string | null
  archived: boolean
}
