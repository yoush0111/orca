import type { RedmineWeeklyReportQuery } from '../../../shared/redmine-types'

const DEFAULT_LOOKBACK_DAYS = 7

export type WeeklyReportRange = { from: string; to: string }

function formatLocalDate(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** today - 7 days … today, in the viewer's local calendar. */
export function defaultWeeklyReportRange(now = new Date()): WeeklyReportRange {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - DEFAULT_LOOKBACK_DAYS)
  return { from: formatLocalDate(from), to: formatLocalDate(now) }
}

export function isValidWeeklyReportRange({ from, to }: WeeklyReportRange): boolean {
  // YYYY-MM-DD compares correctly as a string.
  return Boolean(from) && Boolean(to) && from <= to
}

/** Local midnights → UTC ISO [since, until) so a remote runtime never needs the viewer's timezone. */
export function toWeeklyReportQuery(
  { from, to }: WeeklyReportRange,
  developerFieldId: number | undefined
): RedmineWeeklyReportQuery {
  const since = new Date(`${from}T00:00:00`)
  const until = new Date(`${to}T00:00:00`)
  until.setDate(until.getDate() + 1)
  return {
    since: since.toISOString(),
    until: until.toISOString(),
    ...(developerFieldId ? { developerFieldId } : {})
  }
}

export function weeklyReportFileName({ to }: WeeklyReportRange): string {
  return `${to} 주간보고.md`
}
