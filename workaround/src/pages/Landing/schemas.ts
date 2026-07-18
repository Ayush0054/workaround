import { z } from 'zod'

export const landingSearchSchema = z.object({
  error: z.string().optional(),
})
