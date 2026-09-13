import { z } from 'zod'
import { OptionalFiniteNumber, OptionalString, requiredString } from './rpc-param-primitives'

export const RedmineConnect = z.object({
  baseUrl: requiredString('Base URL is required'),
  apiKey: requiredString('API key is required')
})

export const RedmineIssueQuery = z
  .object({
    mineOnly: z.boolean().optional(),
    projectId: OptionalFiniteNumber,
    statusId: OptionalString,
    limit: OptionalFiniteNumber
  })
  .optional()
