export interface SweepMessage {
  jobId: string
  owner: string
  name: string
  fullName: string
  sealedToken: string
}

export interface SweepTarget {
  owner: string
  name: string
  fullName: string
}

export interface SweepFailure {
  fullName: string
  error: string
}

export interface SweepStatus {
  jobId: string
  total: number
  done: number
  failed: number
  pending: string[]
  completed: string[]
  failures: SweepFailure[]
}
