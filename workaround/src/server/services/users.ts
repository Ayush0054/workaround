import { users } from '../db/schema'
import { database } from '../db/client'
import type { GitHubViewer } from '#/types/github'

export async function upsertUser(viewer: GitHubViewer): Promise<void> {
  const now = Date.now()

  await database()
    .insert(users)
    .values({
      githubId: viewer.id,
      login: viewer.login.toLowerCase(),
      name: viewer.name,
      email: viewer.email,
      avatarUrl: viewer.avatarUrl,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    })
    .onConflictDoUpdate({
      target: users.githubId,
      set: {
        login: viewer.login.toLowerCase(),
        name: viewer.name,
        email: viewer.email,
        avatarUrl: viewer.avatarUrl,
        updatedAt: now,
        lastLoginAt: now,
      },
    })
}
