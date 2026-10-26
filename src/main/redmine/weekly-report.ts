import type {
  RedmineWeeklyReportQuery,
  RedmineWeeklyReportResult
} from '../../shared/redmine-types'
import { mapWithConcurrency } from '../../shared/map-with-concurrency'
import {
  DEFAULT_REDMINE_TRACKER_NAMES,
  type WeeklyReportChange,
  type WeeklyReportIssue
} from '../../shared/redmine-weekly-report'
import type { WeeklyReportCommit } from '../../shared/redmine-weekly-report-commits'
import {
  extractWeeklyReportDescription,
  type WeeklyReportDescription
} from '../../shared/redmine-weekly-report-description'
import { RedmineApiError, redmineGet, requireClient, type ActiveClient } from './client'
import {
  parseRedmineReportIssueDetail,
  parseRedmineReportIssuesPage,
  parseRedmineStatuses,
  parseRedmineTrackerNames,
  parseRedmineViewer,
  redmineCustomFieldValues,
  REDMINE_ISSUE_LIMIT,
  type RedmineReportIssue,
  type RedmineReportIssueDetail
} from './rest-contract'
import {
  collectWeeklyReportCommits,
  weeklyReportGitRepos,
  type WeeklyReportRepo
} from './weekly-report-git'

const DETAIL_CONCURRENCY = 6

type Range = { since: number; until: number }

function inRange(iso: string | null | undefined, range: Range): boolean {
  const time = iso ? Date.parse(iso) : Number.NaN
  return time >= range.since && time < range.until
}

// Why: Redmine's datetime filter regex rejects fractional seconds.
function toRedmineTimestamp(time: number): string {
  return new Date(time).toISOString().replace(/\.\d{3}Z$/, 'Z')
}

async function fetchAllIssues(
  client: ActiveClient,
  params: Record<string, string>
): Promise<RedmineReportIssue[]> {
  const out: RedmineReportIssue[] = []
  for (;;) {
    const query = new URLSearchParams({
      ...params,
      limit: String(REDMINE_ISSUE_LIMIT),
      offset: String(out.length)
    })
    const page = parseRedmineReportIssuesPage(
      await redmineGet(client.baseUrl, client.apiKey, `/issues.json?${query.toString()}`)
    )
    out.push(...page.issues)
    const exhausted =
      page.totalCount === null
        ? page.issues.length < REDMINE_ISSUE_LIMIT
        : out.length >= page.totalCount
    if (page.issues.length === 0 || exhausted) {
      return out
    }
  }
}

async function fetchDetail(
  client: ActiveClient,
  id: number
): Promise<RedmineReportIssueDetail | null> {
  try {
    return parseRedmineReportIssueDetail(
      await redmineGet(client.baseUrl, client.apiKey, `/issues/${id}.json?include=journals`)
    )
  } catch (error) {
    // Spec §5: one unreadable issue must not sink the whole report.
    if (error instanceof RedmineApiError && (error.status === 403 || error.status === 404)) {
      return null
    }
    throw error
  }
}

async function fetchTrackerNames(client: ActiveClient): Promise<string[]> {
  try {
    return parseRedmineTrackerNames(
      await redmineGet(client.baseUrl, client.apiKey, '/trackers.json')
    )
  } catch (error) {
    // Tracker list only refines subject cleanup; the defaults still cover the common tags.
    console.warn('[redmine] tracker list unavailable for weekly report', {
      error: error instanceof Error ? error.message : String(error)
    })
    return []
  }
}

/** Status id → name; empty on failure, and changes then show the raw id. */
async function fetchStatusNames(client: ActiveClient): Promise<Map<string, string>> {
  try {
    const statuses = parseRedmineStatuses(
      await redmineGet(client.baseUrl, client.apiKey, '/issue_statuses.json')
    )
    return new Map(statuses.map((s) => [String(s.id), s.name]))
  } catch (error) {
    console.warn('[redmine] status list unavailable for weekly report', {
      error: error instanceof Error ? error.message : String(error)
    })
    return new Map()
  }
}

type Journal = NonNullable<RedmineReportIssueDetail['journals']>[number]

function toChanges(
  journal: Journal,
  statusNames: ReadonlyMap<string, string>
): WeeklyReportChange[] {
  const status = (id: string | null | undefined): string | null =>
    id ? (statusNames.get(id) ?? id) : null
  return (journal.details ?? []).flatMap((d): WeeklyReportChange[] => {
    if (d.property !== 'attr') {
      return []
    }
    if (d.name === 'status_id') {
      const change = { from: status(d.old_value), to: status(d.new_value) }
      return [{ field: 'status', ...change, createdOn: journal.created_on }]
    }
    if (d.name === 'done_ratio') {
      const change = { from: d.old_value ?? null, to: d.new_value ?? null }
      return [{ field: 'progress', ...change, createdOn: journal.created_on }]
    }
    return []
  })
}

function toReportIssue(
  detail: RedmineReportIssueDetail,
  range: Range,
  statusNames: ReadonlyMap<string, string>,
  commits: WeeklyReportCommit[] | undefined,
  description: WeeklyReportDescription
): WeeklyReportIssue {
  const journals = (detail.journals ?? [])
    .filter((j) => inRange(j.created_on, range))
    .sort((a, b) => Date.parse(a.created_on) - Date.parse(b.created_on))
  // Private notes are kept and flagged; the client's format decides whether they appear.
  const notes = journals
    .filter((j) => j.notes?.trim())
    .map((j) => ({
      text: j.notes ?? '',
      createdOn: j.created_on,
      authorId: j.user?.id ?? null,
      authorName: j.user?.name ?? null,
      isPrivate: j.private_notes === true
    }))
  return {
    id: detail.id,
    subject: detail.subject,
    project: detail.project?.name ?? String(detail.project?.id ?? ''),
    tracker: detail.tracker?.name ?? null,
    status: detail.status?.name ?? null,
    doneRatio: detail.done_ratio ?? null,
    updatedOn: detail.updated_on ?? '',
    notes,
    changes: journals.flatMap((j) => toChanges(j, statusNames)),
    commits: commits ?? [],
    descriptionLines: description.lines
  }
}

async function collectIssues(
  client: ActiveClient,
  query: RedmineWeeklyReportQuery,
  range: Range,
  viewerId: number
): Promise<RedmineReportIssue[]> {
  const base = {
    status_id: '*',
    sort: 'updated_on:desc',
    // `><` is inclusive on both ends, so the upper bound is until - 1s.
    updated_on: `><${toRedmineTimestamp(range.since)}|${toRedmineTimestamp(range.until - 1000)}`
  }
  const assigned = await fetchAllIssues(client, { ...base, assigned_to_id: 'me' })
  const fieldId = query.developerFieldId
  let developer: RedmineReportIssue[] = []
  if (fieldId) {
    const me = String(viewerId)
    // Re-check client side: Redmine ignores cf filters on fields not marked "used as a filter".
    developer = (await fetchAllIssues(client, { ...base, [`cf_${fieldId}`]: me })).filter((i) =>
      redmineCustomFieldValues(i, fieldId).includes(me)
    )
  }
  const unique = new Map([...assigned, ...developer].map((i) => [i.id, i]))
  // Re-check the range client side in case the server drops the time part of the filter.
  return [...unique.values()].filter((i) => inRange(i.updated_on, range))
}

function fetchDetails(
  client: ActiveClient,
  ids: readonly number[]
): Promise<(RedmineReportIssueDetail | null)[]> {
  return mapWithConcurrency(ids, DETAIL_CONCURRENCY, (id) => fetchDetail(client, id))
}

export async function buildWeeklyReport(
  query: RedmineWeeklyReportQuery,
  repos: readonly WeeklyReportRepo[] = []
): Promise<RedmineWeeklyReportResult> {
  const client = requireClient()
  const range = { since: Date.parse(query.since), until: Date.parse(query.until) }
  const viewerId = parseRedmineViewer(
    await redmineGet(client.baseUrl, client.apiKey, '/users/current.json')
  ).id
  const listedIds = (await collectIssues(client, query, range, viewerId)).map((i) => i.id)
  const [listedDetails, fetchedTrackers, statusNames] = await Promise.all([
    fetchDetails(client, listedIds),
    fetchTrackerNames(client),
    fetchStatusNames(client)
  ])
  // Descriptions are parsed here, not on the client: the git scan needs their hash/branch hints
  // and the raw CKEditor HTML is far larger than the few lines the report keeps.
  const descriptions = new Map(
    listedDetails.flatMap((d) => (d ? [[d.id, extractWeeklyReportDescription(d.description)]] : []))
  )
  const git = await collectWeeklyReportCommits(weeklyReportGitRepos(repos), query, descriptions)
  // Issues only reached through commits are the work Redmine itself does not show.
  const listed = new Set(listedIds)
  const extraIds = [...git.byIssue.keys()].filter((id) => !listed.has(id))
  const ids = [...listedIds, ...extraIds]
  const details = [...listedDetails, ...(await fetchDetails(client, extraIds))]
  // Rendering happens on the client so format edits re-render without refetching.
  return {
    issues: details.flatMap((d) =>
      d
        ? [
            toReportIssue(
              d,
              range,
              statusNames,
              git.byIssue.get(d.id),
              descriptions.get(d.id) ?? extractWeeklyReportDescription(d.description)
            )
          ]
        : []
    ),
    baseUrl: client.baseUrl,
    viewerId,
    trackerNames: [...new Set([...DEFAULT_REDMINE_TRACKER_NAMES, ...fetchedTrackers])],
    skippedIssueIds: ids.filter((_, index) => !details[index]),
    gitRepoCount: git.repoCount
  }
}
