import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WEEKLY_REPORT_FORMAT,
  fillWeeklyReportTemplate,
  formatWeeklyReportDate,
  resolveWeeklyReportFormat
} from './redmine-weekly-report-format'

describe('resolveWeeklyReportFormat', () => {
  it('returns defaults for missing settings', () => {
    expect(resolveWeeklyReportFormat(undefined)).toEqual(DEFAULT_WEEKLY_REPORT_FORMAT)
  })

  it('keeps valid overrides and falls back per field on bad values', () => {
    const format = resolveWeeklyReportFormat({
      issueTemplate: '- {subject}',
      dateFormat: 'nope',
      commentMaxChars: -1
    })
    expect(format.issueTemplate).toBe('- {subject}')
    expect(format.dateFormat).toBe(DEFAULT_WEEKLY_REPORT_FORMAT.dateFormat)
    expect(format.commentMaxChars).toBe(DEFAULT_WEEKLY_REPORT_FORMAT.commentMaxChars)
  })
})

describe('fillWeeklyReportTemplate', () => {
  it('replaces known tokens and leaves unknown ones literal', () => {
    expect(fillWeeklyReportTemplate('{a}-{b}-{a}', { a: 'x' })).toBe('x-{b}-x')
  })
})

describe('formatWeeklyReportDate', () => {
  it('formats in the viewer offset', () => {
    const iso = '2026-09-30T15:30:00Z'
    expect(formatWeeklyReportDate(iso, 540, 'YY.MM.DD')).toBe('26.10.01')
    expect(formatWeeklyReportDate(iso, 540, 'YYYY-MM-DD')).toBe('2026-10-01')
    expect(formatWeeklyReportDate(iso, 540, 'MM.DD')).toBe('10.01')
    expect(formatWeeklyReportDate(iso, 0, 'M/D')).toBe('9/30')
  })
})
