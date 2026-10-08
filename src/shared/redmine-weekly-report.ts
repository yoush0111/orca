// Pure weekly-report shaping (docs/weekly-report-process.md §Step 4–6). No I/O.

export type WeeklyReportIssue = {
  id: number
  subject: string
  project: string
  tracker: string | null
  doneRatio: number | null
  /** UTC ISO. */
  updatedOn: string
  /** Raw note bodies in created_on order, already range- and privacy-filtered. */
  notes: string[]
}

export type WeeklyReportTrackerGroup = { tracker: string; issues: WeeklyReportIssue[] }
export type WeeklyReportProjectGroup = { project: string; trackers: WeeklyReportTrackerGroup[] }

export type WeeklyReportRenderOptions = {
  baseUrl: string
  utcOffsetMinutes: number
  trackerNames: readonly string[]
}

export const DEFAULT_REDMINE_TRACKER_NAMES = ['신규기능', '오류', '기능개선', '지원']
const TRACKER_ORDER = ['신규기능', '기능개선', '오류', '지원']
const NO_TRACKER = '기타'
const SUMMARY_MAX_CHARS = 80
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
export function summarizeRedmineNote(notes: string): string {
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
    return chars.length > SUMMARY_MAX_CHARS
      ? `${chars.slice(0, SUMMARY_MAX_CHARS).join('')}…`
      : line
  }
  return ''
}

function trackerRank(tracker: string): number {
  const fixed = TRACKER_ORDER.indexOf(tracker)
  if (fixed !== -1) {
    return fixed
  }
  return tracker === NO_TRACKER ? TRACKER_ORDER.length + 1 : TRACKER_ORDER.length
}

function compareTrackers(a: string, b: string): number {
  return trackerRank(a) - trackerRank(b) || a.localeCompare(b, 'ko')
}

/** Project (가나다) → fixed tracker order → updated_on ascending. */
export function groupWeeklyReportIssues(
  issues: readonly WeeklyReportIssue[]
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
        .sort(([a], [b]) => compareTrackers(a, b))
        .map(([tracker, grouped]) => ({
          tracker,
          issues: [...grouped].sort((x, y) => Date.parse(x.updatedOn) - Date.parse(y.updatedOn))
        }))
    }))
}

function formatShortDate(iso: string, utcOffsetMinutes: number): string {
  const shifted = new Date(Date.parse(iso) + utcOffsetMinutes * 60_000)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${pad(shifted.getUTCFullYear() % 100)}.${pad(shifted.getUTCMonth() + 1)}.${pad(shifted.getUTCDate())}`
}

function renderIssue(issue: WeeklyReportIssue, options: WeeklyReportRenderOptions): string {
  const subject = cleanRedmineSubject(issue.subject, options.trackerNames)
  const link = `[#${issue.id}](${options.baseUrl}/issues/${issue.id})`
  const date = formatShortDate(issue.updatedOn, options.utcOffsetMinutes)
  const progress = issue.doneRatio ?? '??'
  const lines = [`- ${subject} (${link}) (${date} ${progress}%)`]
  for (const note of issue.notes) {
    const summary = summarizeRedmineNote(note)
    if (summary) {
      // Tab, not spaces: Obsidian renders it as a nested <ul> that pastes into Slack intact.
      lines.push(`\t- ${summary}`)
    }
  }
  return lines.join('\n')
}

/** Spec §6.1 body only — no title or preamble. Empty string when there are no issues. */
export function renderWeeklyReport(
  issues: readonly WeeklyReportIssue[],
  options: WeeklyReportRenderOptions
): string {
  const groups = groupWeeklyReportIssues(issues)
  if (groups.length === 0) {
    return ''
  }
  const blocks = groups.map((group) =>
    [
      `**[${group.project}]**`,
      '',
      group.trackers
        .map((tracker) =>
          [`*${tracker.tracker}*`, ...tracker.issues.map((i) => renderIssue(i, options))].join('\n')
        )
        .join('\n\n')
    ].join('\n')
  )
  return `${blocks.join('\n\n')}\n`
}

type HtmlBlock =
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: { text: string; children: string[] }[] }

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inlineHtml(text: string): string {
  return escapeHtml(text)
    .replace(/\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>')
}

function toHtmlBlocks(markdown: string): HtmlBlock[] {
  const blocks: HtmlBlock[] = []
  for (const line of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    const last = blocks.at(-1)
    const child = /^(?:\t+| {2,})[-*] (.*)$/.exec(line)
    const item = /^[-*] (.*)$/.exec(line)
    if (child && last?.kind === 'ul' && last.items.length > 0) {
      last.items.at(-1)?.children.push(child[1])
    } else if (item || child) {
      const entry = { text: (item ?? child)?.[1] ?? '', children: [] }
      if (last?.kind === 'ul') {
        last.items.push(entry)
      } else {
        blocks.push({ kind: 'ul', items: [entry] })
      }
    } else if (line.trim()) {
      blocks.push({ kind: 'p', text: line.trim() })
    }
  }
  return blocks
}

/** Slack renders pasted HTML (not Markdown), so "Copy for Slack" puts this on the clipboard. */
export function weeklyReportMarkdownToHtml(markdown: string): string {
  return toHtmlBlocks(markdown)
    .map((block) =>
      block.kind === 'p'
        ? `<p>${inlineHtml(block.text)}</p>`
        : `<ul>${block.items
            .map((entry) => {
              const nested = entry.children.length
                ? `<ul>${entry.children.map((c) => `<li>${inlineHtml(c)}</li>`).join('')}</ul>`
                : ''
              return `<li>${inlineHtml(entry.text)}${nested}</li>`
            })
            .join('')}</ul>`
    )
    .join('')
}
