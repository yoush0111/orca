// Pure weekly-report shaping (docs/weekly-report-process.md §Step 4–6). No I/O.
import {
  DEFAULT_WEEKLY_REPORT_FORMAT,
  fillWeeklyReportTemplate,
  formatWeeklyReportDate,
  type WeeklyReportFormat
} from './redmine-weekly-report-format'

export type WeeklyReportNote = {
  text: string
  /** UTC ISO. */
  createdOn: string
  authorId: number | null
  authorName: string | null
  isPrivate: boolean
}

export type WeeklyReportIssue = {
  id: number
  subject: string
  project: string
  tracker: string | null
  status: string | null
  doneRatio: number | null
  /** UTC ISO. */
  updatedOn: string
  /** Non-empty notes inside the report range, in created_on order. */
  notes: WeeklyReportNote[]
}

export type WeeklyReportTrackerGroup = { tracker: string; issues: WeeklyReportIssue[] }
export type WeeklyReportProjectGroup = { project: string; trackers: WeeklyReportTrackerGroup[] }

export type WeeklyReportRenderOptions = {
  baseUrl: string
  utcOffsetMinutes: number
  trackerNames: readonly string[]
  viewerId: number | null
  format?: WeeklyReportFormat
}

export const DEFAULT_REDMINE_TRACKER_NAMES = ['신규기능', '오류', '기능개선', '지원']
const NO_TRACKER = '기타'
const LEADING_TAG = /^\s*\[([^\]]+)\]\s*/

/** Strips leading tracker tags only; the first non-tracker tag is domain content and stays. */
export function cleanRedmineSubject(subject: string, trackerNames: readonly string[]): string {
  let rest = subject
  let match = LEADING_TAG.exec(rest)
  while (match && trackerNames.includes(match[1].trim())) {
    rest = rest.slice(match[0].length)
    match = LEADING_TAG.exec(rest)
  }
  return rest.trim()
}

function stripInlineMarkup(line: string): string {
  return (
    line
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/![<>=]?[^\s!]+!/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/"([^"]+)":\S+/g, '$1')
      .replace(/^\s*(?:h[1-6]\.|#{1,6}|[*\-+]|\d+\.)\s+/, '')
      // Word-bounded so identifiers like snake_case or C++ survive.
      .replace(/(^|\s)(\*\*|__|\*|_|@|`|~~|\+)(\S(?:.*?\S)?)\2(?=$|\s|[.,!?)])/g, '$1$3')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/** Rule-based one-liner (spec §Step 4 method B): drop quotes/code/images/markup, keep the first line. */
export function summarizeRedmineNote(
  notes: string,
  maxChars = DEFAULT_WEEKLY_REPORT_FORMAT.commentMaxChars
): string {
  const withoutBlocks = notes
    .replace(/\r\n?/g, '\n')
    .replace(/```[\s\S]*?(?:```|$)/g, '\n')
    .replace(/<pre>[\s\S]*?(?:<\/pre>|$)/gi, '\n')
  for (const rawLine of withoutBlocks.split('\n')) {
    if (/^\s*(?:>|bq\.)/.test(rawLine)) {
      continue
    }
    const line = stripInlineMarkup(rawLine)
    if (!line) {
      continue
    }
    const chars = Array.from(line)
    return chars.length > maxChars ? `${chars.slice(0, maxChars).join('')}…` : line
  }
  return ''
}

function compareTrackers(a: string, b: string, order: readonly string[]): number {
  const rank = (tracker: string): number => {
    const fixed = order.indexOf(tracker)
    if (fixed !== -1) {
      return fixed
    }
    return tracker === NO_TRACKER ? order.length + 1 : order.length
  }
  return rank(a) - rank(b) || a.localeCompare(b, 'ko')
}

/** Project (가나다) → tracker order → updated_on ascending. */
export function groupWeeklyReportIssues(
  issues: readonly WeeklyReportIssue[],
  trackerOrder: readonly string[] = DEFAULT_WEEKLY_REPORT_FORMAT.trackerOrder
): WeeklyReportProjectGroup[] {
  const byProject = new Map<string, Map<string, WeeklyReportIssue[]>>()
  for (const issue of issues) {
    const tracker = issue.tracker?.trim() || NO_TRACKER
    const trackers = byProject.get(issue.project) ?? new Map<string, WeeklyReportIssue[]>()
    trackers.set(tracker, [...(trackers.get(tracker) ?? []), issue])
    byProject.set(issue.project, trackers)
  }
  return [...byProject.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'ko'))
    .map(([project, trackers]) => ({
      project,
      trackers: [...trackers.entries()]
        .sort(([a], [b]) => compareTrackers(a, b, trackerOrder))
        .map(([tracker, grouped]) => ({
          tracker,
          issues: [...grouped].sort((x, y) => Date.parse(x.updatedOn) - Date.parse(y.updatedOn))
        }))
    }))
}

function isNoteIncluded(
  note: WeeklyReportNote,
  format: WeeklyReportFormat,
  viewerId: number | null
): boolean {
  if (!format.includeComments || (note.isPrivate && !format.includePrivateNotes)) {
    return false
  }
  return format.includeOthersComments || note.authorId === viewerId
}

function renderIssue(
  issue: WeeklyReportIssue,
  options: WeeklyReportRenderOptions,
  format: WeeklyReportFormat
): string {
  const date = (iso: string): string =>
    formatWeeklyReportDate(iso, options.utcOffsetMinutes, format.dateFormat)
  const lines = [
    fillWeeklyReportTemplate(format.issueTemplate, {
      subject: format.stripTrackerTags
        ? cleanRedmineSubject(issue.subject, options.trackerNames)
        : issue.subject.trim(),
      id: String(issue.id),
      url: `${options.baseUrl}/issues/${issue.id}`,
      date: date(issue.updatedOn),
      progress: issue.doneRatio === null ? '??' : String(issue.doneRatio),
      status: issue.status ?? '',
      tracker: issue.tracker ?? NO_TRACKER,
      project: issue.project
    })
  ]
  for (const note of issue.notes) {
    const comment = isNoteIncluded(note, format, options.viewerId)
      ? summarizeRedmineNote(note.text, format.commentMaxChars)
      : ''
    if (comment) {
      lines.push(
        fillWeeklyReportTemplate(format.commentTemplate, {
          comment,
          author: note.authorName ?? '',
          date: date(note.createdOn)
        })
      )
    }
  }
  return lines.join('\n')
}

/** Body only — no title or preamble. Empty string when there are no issues. */
export function renderWeeklyReport(
  issues: readonly WeeklyReportIssue[],
  options: WeeklyReportRenderOptions
): string {
  const format = options.format ?? DEFAULT_WEEKLY_REPORT_FORMAT
  const groups = groupWeeklyReportIssues(issues, format.trackerOrder)
  if (groups.length === 0) {
    return ''
  }
  const blocks = groups.map((group) =>
    [
      fillWeeklyReportTemplate(format.projectTemplate, { project: group.project }),
      '',
      group.trackers
        .map((tracker) =>
          [
            fillWeeklyReportTemplate(format.trackerTemplate, { tracker: tracker.tracker }),
            ...tracker.issues.map((i) => renderIssue(i, options, format))
          ].join('\n')
        )
        .join('\n\n')
    ].join('\n')
  )
  return `${blocks.join('\n\n')}\n`
}
