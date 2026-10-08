import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()

vi.mock('../network/http-client', () => ({
  getMainHttpClient: () => ({
    fetch: (...args: unknown[]) => fetchMock(...args),
    proxySession: () => null
  })
}))
vi.mock('../network/proxy-settings', () => ({
  ensureElectronProxyFromEnvironment: vi.fn().mockResolvedValue(undefined)
}))
vi.mock('./credential-store', () => ({
  readConnectionRecord: () => ({
    version: 1,
    baseUrl: 'https://rm.example',
    viewerId: 10,
    login: 'kim',
    displayName: 'Kim',
    email: null
  }),
  readApiKey: () => 'secret',
  hasStoredApiKey: () => true,
  getCredentialError: () => null,
  saveConnection: vi.fn(),
  clearConnection: vi.fn()
}))

import { buildWeeklyReport } from './weekly-report'

const QUERY = {
  since: '2026-09-30T15:00:00.000Z',
  until: '2026-10-08T15:00:00.000Z',
  utcOffsetMinutes: 540
}

type ListIssue = {
  id: number
  subject: string
  updated_on: string
  custom_fields?: { id: number; value: string | string[] }[]
}

function listIssue(id: number, updated_on = '2026-10-05T00:00:00Z'): ListIssue {
  return { id, subject: `일감 ${id}`, updated_on }
}

function detail(id: number, journals: unknown[] = [], updated_on = '2026-10-05T00:00:00Z') {
  return {
    issue: {
      id,
      subject: `일감 ${id}`,
      project: { id: 1, name: 'P' },
      tracker: { id: 1, name: '신규기능' },
      done_ratio: 10,
      updated_on,
      journals
    }
  }
}

type Routes = {
  assigned?: ListIssue[][]
  developer?: ListIssue[]
  details?: Record<number, unknown>
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status })
}

function installRoutes(routes: Routes): void {
  fetchMock.mockImplementation(async (url: string) => {
    const parsed = new URL(url)
    if (parsed.pathname === '/users/current.json') {
      return json(200, { user: { id: 10, login: 'kim' } })
    }
    if (parsed.pathname === '/trackers.json') {
      return json(200, { trackers: [{ id: 1, name: '신규기능' }] })
    }
    if (parsed.pathname === '/issues.json') {
      if (parsed.searchParams.has('cf_31')) {
        const issues = routes.developer ?? []
        return json(200, { issues, total_count: issues.length })
      }
      const pages = routes.assigned ?? [[]]
      const pageIndex = Number(parsed.searchParams.get('offset')) / 100
      const total = pages.reduce((sum, page) => sum + page.length, 0)
      return json(200, { issues: pages[pageIndex] ?? [], total_count: total })
    }
    const id = Number(/\/issues\/(\d+)\.json/.exec(parsed.pathname)?.[1])
    const body = routes.details?.[id]
    return body === undefined ? json(403, {}) : json(200, body)
  })
}

function requestedUrls(): URL[] {
  return fetchMock.mock.calls.map(([url]) => new URL(String(url)))
}

describe('buildWeeklyReport', () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it('queries all statuses with a second-precision updated_on range (T4)', async () => {
    installRoutes({})
    await buildWeeklyReport(QUERY)
    const list = requestedUrls().find((u) => u.pathname === '/issues.json')
    expect(list?.searchParams.get('status_id')).toBe('*')
    expect(list?.searchParams.get('assigned_to_id')).toBe('me')
    expect(list?.searchParams.get('updated_on')).toBe('><2026-09-30T15:00:00Z|2026-10-08T14:59:59Z')
  })

  it('pages through more than 100 issues (T10)', async () => {
    const first = Array.from({ length: 100 }, (_, i) => listIssue(i + 1))
    const details = Object.fromEntries([...first, listIssue(101)].map((i) => [i.id, detail(i.id)]))
    installRoutes({ assigned: [first, [listIssue(101)]], details })
    const result = await buildWeeklyReport(QUERY)
    expect(result.issueCount).toBe(101)
  })

  it('dedupes assignee/developer hits and re-checks the developer field (T1, T2, T13)', async () => {
    installRoutes({
      assigned: [[listIssue(1)]],
      developer: [
        { ...listIssue(1), custom_fields: [{ id: 31, value: '10' }] },
        { ...listIssue(2), custom_fields: [{ id: 31, value: ['10', '12'] }] },
        // Server ignored the cf filter: someone else's issue.
        { ...listIssue(3), custom_fields: [{ id: 31, value: '99' }] }
      ],
      details: { 1: detail(1), 2: detail(2), 3: detail(3) }
    })
    const result = await buildWeeklyReport({ ...QUERY, developerFieldId: 31 })
    expect(result.issueCount).toBe(2)
    expect(result.markdown.match(/\[#1\]/g)).toHaveLength(1)
    expect(result.markdown).toContain('[#2]')
    expect(result.markdown).not.toContain('[#3]')
  })

  it('skips the developer query when no field id is configured', async () => {
    installRoutes({})
    await buildWeeklyReport(QUERY)
    expect(requestedUrls().some((u) => u.searchParams.has('cf_31'))).toBe(false)
  })

  it('filters issue and comment ranges on [since, until) and drops private notes (T3)', async () => {
    installRoutes({
      assigned: [
        [
          listIssue(1, '2026-09-30T14:59:59Z'),
          listIssue(2, '2026-09-30T15:00:00Z'),
          listIssue(3, '2026-10-08T15:00:00Z')
        ]
      ],
      details: {
        2: detail(
          2,
          [
            { id: 1, notes: '기간 전', created_on: '2026-09-30T14:00:00Z' },
            { id: 2, notes: '', created_on: '2026-10-01T00:00:00Z' },
            { id: 3, notes: '비공개', created_on: '2026-10-02T00:00:00Z', private_notes: true },
            { id: 4, notes: '둘째', created_on: '2026-10-04T00:00:00Z' },
            { id: 5, notes: '첫째', created_on: '2026-10-03T00:00:00Z' }
          ],
          '2026-09-30T15:00:00Z'
        )
      }
    })
    const result = await buildWeeklyReport(QUERY)
    expect(result.issueCount).toBe(1)
    expect(result.markdown).toContain('[#2]')
    expect(result.markdown).toContain('\t- 첫째\n\t- 둘째')
    expect(result.markdown).not.toContain('기간 전')
    expect(result.markdown).not.toContain('비공개')
  })

  it('skips issues whose detail read is forbidden and keeps the rest', async () => {
    installRoutes({ assigned: [[listIssue(1), listIssue(2)]], details: { 1: detail(1) } })
    const result = await buildWeeklyReport(QUERY)
    expect(result.issueCount).toBe(1)
    expect(result.skippedIssueIds).toEqual([2])
  })
})
