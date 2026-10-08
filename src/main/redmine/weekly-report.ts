import type {
  RedmineWeeklyReportQuery,
  RedmineWeeklyReportResult
} from '../../shared/redmine-types'
import { mapWithConcurrency } from '../../shared/map-with-concurrency'
import {
  DEFAULT_REDMINE_TRACKER_NAMES,
  renderWeeklyReport,
  type WeeklyReportIssue
} from '../../shared/redmine-weekly-report'
import { RedmineApiError, redmineGet, requireClient, type ActiveClient } from './client'
import {
  parseRedmineReportIssueDetail,
  parseRedmineReportIssuesPage,
  parseRedmineTrackerNames,
  parseRedmineViewer,
  redmineCustomFieldValues,
  REDMINE_ISSUE_LIMIT,
  type RedmineReportIssue,
  type RedmineReportIssueDetail
} from './rest-contract'

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

function toReportIssue(detail: RedmineReportIssueDetail, range: Range): WeeklyReportIssue {
  const notes = (detail.journals ?? [])
    // Private notes stay out: the report is shared to a team channel.
    .filter((j) => j.notes?.trim() && !j.private_notes && inRange(j.created_on, range))
    .sort((a, b) => Date.parse(a.created_on) - Date.parse(b.created_on))
    .map((j) => j.notes ?? '')
  return {
    id: detail.id,
    subject: detail.subject,
    project: detail.project?.name ?? String(detail.project?.id ?? ''),
    tracker: detail.tracker?.name ?? null,
    doneRatio: detail.done_ratio ?? null,
    updatedOn: detail.updated_on ?? '',
    notes
  }
}

async function collectIssues(
  client: ActiveClient,
  query: RedmineWeeklyReportQuery,
  range: Range
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
    const me = String(
      parseRedmineViewer(await redmineGet(client.baseUrl, client.apiKey, '/users/current.json')).id
    )
    // Re-check client side: Redmine ignores cf filters on fields not marked "used as a filter".
    developer = (await fetchAllIssues(client, { ...base, [`cf_${fieldId}`]: me })).filter((i) =>
      redmineCustomFieldValues(i, fieldId).includes(me)
    )
  }
  const unique = new Map([...assigned, ...developer].map((i) => [i.id, i]))
  // Re-check the range client side in case the server drops the time part of the filter.
  return [...unique.values()].filter((i) => inRange(i.updated_on, range))
}

export async function buildWeeklyReport(
  query: RedmineWeeklyReportQuery
): Promise<RedmineWeeklyReportResult> {
  const client = requireClient()
  const range = { since: Date.parse(query.since), until: Date.parse(query.until) }
  const issues = await collectIssues(client, query, range)
  const [details, fetchedTrackers] = await Promise.all([
    mapWithConcurrency(issues, DETAIL_CONCURRENCY, (i) => fetchDetail(client, i.id)),
    issues.length > 0 ? fetchTrackerNames(client) : Promise.resolve([])
  ])
  const skippedIssueIds = issues.filter((_, index) => !details[index]).map((i) => i.id)
  const reportIssues = details.flatMap((d) => (d ? [toReportIssue(d, range)] : []))
  return {
    markdown: renderWeeklyReport(reportIssues, {
      baseUrl: client.baseUrl,
      utcOffsetMinutes: query.utcOffsetMinutes,
      trackerNames: [...new Set([...DEFAULT_REDMINE_TRACKER_NAMES, ...fetchedTrackers])]
    }),
    issueCount: reportIssues.length,
    skippedIssueIds
  }
}
