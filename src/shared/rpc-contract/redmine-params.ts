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

export const RedmineWeeklyReportQuery = z
  .object({
    since: z.iso.datetime(),
    until: z.iso.datetime(),
    developerFieldId: z.number().int().positive().optional()
  })
  .refine((query) => Date.parse(query.since) < Date.parse(query.until), {
    message: 'Start date must be before end date'
  })

export const RedmineWeeklyReportSave = z.object({
  fileName: z.string(),
  markdown: z.string(),
  defaultDir: z.string().optional()
})

// Clipboard writes are local-only; the cap just bounds a pathological paste.
export const RedmineWeeklyReportMarkdown = z.string().max(1_000_000)
