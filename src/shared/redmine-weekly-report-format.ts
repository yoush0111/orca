import { z } from 'zod'

// User-editable weekly report format. Defaults reproduce docs/weekly-report-process.md §6.1.

export const WEEKLY_REPORT_DATE_FORMATS = ['YY.MM.DD', 'YYYY-MM-DD', 'MM.DD', 'M/D'] as const
export type WeeklyReportDateFormat = (typeof WEEKLY_REPORT_DATE_FORMATS)[number]

export type WeeklyReportFormat = {
  projectTemplate: string
  trackerTemplate: string
  issueTemplate: string
  commentTemplate: string
  dateFormat: WeeklyReportDateFormat
  /** Trackers listed here come first in this order; others follow alphabetically, then 기타. */
  trackerOrder: string[]
  stripTrackerTags: boolean
  commentMaxChars: number
  includeComments: boolean
  includeOthersComments: boolean
  includePrivateNotes: boolean
}

export const DEFAULT_WEEKLY_REPORT_FORMAT: WeeklyReportFormat = {
  projectTemplate: '**[{project}]**',
  trackerTemplate: '*{tracker}*',
  issueTemplate: '- {subject} ([#{id}]({url})) ({date} {progress}%)',
  // Tab, not spaces: Obsidian renders it as a nested <ul> that pastes into Slack intact.
  commentTemplate: '\t- {comment}',
  dateFormat: 'YY.MM.DD',
  trackerOrder: ['신규기능', '기능개선', '오류', '지원'],
  stripTrackerTags: true,
  commentMaxChars: 80,
  includeComments: true,
  includeOthersComments: true,
  includePrivateNotes: false
}

export const WEEKLY_REPORT_PLACEHOLDERS = {
  project: ['project'],
  tracker: ['tracker'],
  issue: ['subject', 'id', 'url', 'date', 'progress', 'status', 'tracker', 'project'],
  comment: ['comment', 'author', 'date']
} as const

const D = DEFAULT_WEEKLY_REPORT_FORMAT

// Each field falls back on its own, so one bad value in settings never discards the rest.
const StoredFormatSchema = z.object({
  projectTemplate: z.string().catch(D.projectTemplate),
  trackerTemplate: z.string().catch(D.trackerTemplate),
  issueTemplate: z.string().catch(D.issueTemplate),
  commentTemplate: z.string().catch(D.commentTemplate),
  dateFormat: z.enum(WEEKLY_REPORT_DATE_FORMATS).catch(D.dateFormat),
  trackerOrder: z.array(z.string()).catch(D.trackerOrder),
  stripTrackerTags: z.boolean().catch(D.stripTrackerTags),
  commentMaxChars: z.number().int().min(10).max(1000).catch(D.commentMaxChars),
  includeComments: z.boolean().catch(D.includeComments),
  includeOthersComments: z.boolean().catch(D.includeOthersComments),
  includePrivateNotes: z.boolean().catch(D.includePrivateNotes)
})

export function resolveWeeklyReportFormat(stored: unknown): WeeklyReportFormat {
  const parsed = StoredFormatSchema.safeParse(stored && typeof stored === 'object' ? stored : {})
  return parsed.success ? parsed.data : DEFAULT_WEEKLY_REPORT_FORMAT
}

/** Unknown `{name}` tokens stay literal so typos are visible in the preview. */
export function fillWeeklyReportTemplate(
  template: string,
  values: Readonly<Record<string, string>>
): string {
  return template.replace(/\{(\w+)\}/g, (token, name: string) =>
    Object.hasOwn(values, name) ? values[name] : token
  )
}

export function formatWeeklyReportDate(
  iso: string,
  utcOffsetMinutes: number,
  format: WeeklyReportDateFormat
): string {
  const shifted = new Date(Date.parse(iso) + utcOffsetMinutes * 60_000)
  if (Number.isNaN(shifted.getTime())) {
    return ''
  }
  const year = shifted.getUTCFullYear()
  const month = shifted.getUTCMonth() + 1
  const day = shifted.getUTCDate()
  const pad = (value: number): string => String(value).padStart(2, '0')
  switch (format) {
    case 'YYYY-MM-DD':
      return `${year}-${pad(month)}-${pad(day)}`
    case 'MM.DD':
      return `${pad(month)}.${pad(day)}`
    case 'M/D':
      return `${month}/${day}`
    case 'YY.MM.DD':
      return `${pad(year % 100)}.${pad(month)}.${pad(day)}`
  }
}
