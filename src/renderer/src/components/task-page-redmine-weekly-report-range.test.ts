import { describe, expect, it } from 'vitest'
import {
  defaultWeeklyReportRange,
  isValidWeeklyReportRange,
  toWeeklyReportQuery,
  weeklyReportFileName
} from './task-page-redmine-weekly-report-range'

describe('weekly report range', () => {
  it('defaults to today - 7 days … today', () => {
    expect(defaultWeeklyReportRange(new Date(2026, 9, 8, 13, 30))).toEqual({
      from: '2026-10-01',
      to: '2026-10-08'
    })
    // Crosses a month boundary in the local calendar.
    expect(defaultWeeklyReportRange(new Date(2026, 2, 3)).from).toBe('2026-02-24')
  })

  it('rejects empty values and start after end', () => {
    expect(isValidWeeklyReportRange({ from: '2026-10-01', to: '2026-10-08' })).toBe(true)
    expect(isValidWeeklyReportRange({ from: '2026-10-08', to: '2026-10-08' })).toBe(true)
    expect(isValidWeeklyReportRange({ from: '2026-10-09', to: '2026-10-08' })).toBe(false)
    expect(isValidWeeklyReportRange({ from: '', to: '2026-10-08' })).toBe(false)
  })

  it('converts local midnights to a UTC [since, until) query', () => {
    const query = toWeeklyReportQuery({ from: '2026-10-01', to: '2026-10-08' }, 31)
    expect(query).toEqual({
      since: new Date(2026, 9, 1).toISOString(),
      until: new Date(2026, 9, 9).toISOString(),
      utcOffsetMinutes: -new Date(2026, 9, 1).getTimezoneOffset(),
      developerFieldId: 31
    })
    expect(
      toWeeklyReportQuery({ from: '2026-10-01', to: '2026-10-08' }, undefined)
    ).not.toHaveProperty('developerFieldId')
  })

  it('names the file after the end date', () => {
    expect(weeklyReportFileName({ from: '2026-10-01', to: '2026-10-08' })).toBe(
      '2026-10-08 주간보고.md'
    )
  })
})
