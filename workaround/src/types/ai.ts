import type { Signal } from '#/lib/repo-scoring'

export interface AiVerdict {
  fullName: string
  verdict: 'unstar' | 'keep' | 'unsure'
  reason: string
}

export interface CandidatePayload {
  fullName: string
  description: string | null
  language: string | null
  stargazersCount: number
  pushedAt: string | null
  starredAt: string
  archived: boolean
  signals: Signal[]
}

export interface CompactRepo {
  fullName: string
  description: string | null
  language: string | null
  pushedAt?: string | null
  starredAt?: string
  archived?: boolean
  signals?: Signal[]
}
