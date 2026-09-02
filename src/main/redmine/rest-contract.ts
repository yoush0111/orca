import { z } from 'zod'
import type {
  RedmineIssue,
  RedmineIssueQuery,
  RedmineNamedRef,
  RedmineProject,
  RedmineViewer
} from '../../shared/redmine-types'

export const REDMINE_ISSUE_LIMIT = 100

const NamedRefSchema = z.object({
  id: z.number(),
  name: z.string().optional()
})

const IssueSchema = z.object({
  id: z.number(),
  subject: z.string(),
  description: z.string().nullish(),
  done_ratio: z.number().nullish(),
  updated_on: z.string().nullish(),
  project: NamedRefSchema.nullish(),
  status: NamedRefSchema.nullish(),
  assigned_to: NamedRefSchema.nullish()
})

const IssuesResponseSchema = z.object({ issues: z.array(IssueSchema).nullish() })

const ProjectsResponseSchema = z.object({
  projects: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        identifier: z.string().nullish(),
        parent: NamedRefSchema.nullish()
      })
    )
    .nullish()
})

const StatusesResponseSchema = z.object({ issue_statuses: z.array(NamedRefSchema).nullish() })

const ViewerResponseSchema = z.object({
  user: z.object({
    id: z.number(),
    login: z.string().nullish(),
    firstname: z.string().nullish(),
    lastname: z.string().nullish(),
    mail: z.string().nullish()
  })
})

/** Trailing slashes would produce `//issues.json`, which some reverse proxies 404. */
export function normalizeRedmineBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '')
  if (!trimmed) {
    throw new Error('Enter a Redmine base URL.')
  }
  const parsed = new URL(trimmed)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Redmine base URL must be http or https.')
  }
  return trimmed
}

export function clampRedmineLimit(limit: number | undefined): number {
  const value = typeof limit === 'number' && Number.isFinite(limit) ? limit : REDMINE_ISSUE_LIMIT
  return Math.min(Math.max(1, Math.trunc(value)), REDMINE_ISSUE_LIMIT)
}

/** Mirrors the launcher's filter combination: status + optional mine/project. */
export function buildRedmineIssuesQuery(query: RedmineIssueQuery): string {
  const params = new URLSearchParams()
  params.set('status_id', query.statusId?.trim() || 'open')
  params.set('limit', String(clampRedmineLimit(query.limit)))
  if (query.mineOnly) {
    params.set('assigned_to_id', 'me')
  }
  if (typeof query.projectId === 'number' && Number.isFinite(query.projectId)) {
    params.set('project_id', String(query.projectId))
  }
  params.set('sort', 'updated_on:desc')
  return params.toString()
}

function toNamedRef(
  value: { id: number; name?: string } | null | undefined
): RedmineNamedRef | null {
  return value ? { id: value.id, name: value.name ?? String(value.id) } : null
}

export function parseRedmineIssues(payload: unknown, baseUrl: string): RedmineIssue[] {
  const parsed = IssuesResponseSchema.parse(payload)
  return (parsed.issues ?? []).map((issue) => ({
    id: issue.id,
    subject: issue.subject,
    ...(issue.description ? { description: issue.description } : {}),
    doneRatio: issue.done_ratio ?? 0,
    project: toNamedRef(issue.project),
    status: toNamedRef(issue.status),
    assignedTo: toNamedRef(issue.assigned_to),
    ...(issue.updated_on ? { updatedAt: issue.updated_on } : {}),
    url: `${baseUrl}/issues/${issue.id}`
  }))
}

export function parseRedmineProjects(payload: unknown): RedmineProject[] {
  const parsed = ProjectsResponseSchema.parse(payload)
  return (parsed.projects ?? [])
    .map((project) => ({
      id: project.id,
      name: project.name,
      identifier: project.identifier ?? String(project.id),
      parent: toNamedRef(project.parent)
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function parseRedmineStatuses(payload: unknown): RedmineNamedRef[] {
  const parsed = StatusesResponseSchema.parse(payload)
  return (parsed.issue_statuses ?? []).flatMap((status) => {
    const ref = toNamedRef(status)
    return ref ? [ref] : []
  })
}

export function parseRedmineViewer(payload: unknown): RedmineViewer {
  const { user } = ViewerResponseSchema.parse(payload)
  const displayName = [user.firstname, user.lastname].filter(Boolean).join(' ').trim()
  return {
    id: user.id,
    login: user.login ?? String(user.id),
    displayName: displayName || user.login || String(user.id),
    email: user.mail ?? null
  }
}
