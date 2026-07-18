import type { z } from 'zod'

export function redirect(location: string): Response {
  return new Response(null, { status: 302, headers: { Location: location } })
}

export async function parseJson<T>(
  response: Response,
  schema: z.ZodType<T>,
): Promise<T> {
  return schema.parse(await response.json())
}

export function parseJsonText<T>(value: string, schema: z.ZodType<T>): T {
  return schema.parse(JSON.parse(value))
}
