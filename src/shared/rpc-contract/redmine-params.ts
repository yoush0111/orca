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

export const REDMINE_NOTE_MAX_CHARS = 65_000

export const RedmineIssueId = z.object({ id: z.number().int().positive() })

export const RedmineIssueNote = z.object({
  id: z.number().int().positive(),
  notes: z.string().trim().min(1, 'Note is required').max(REDMINE_NOTE_MAX_CHARS)
})
