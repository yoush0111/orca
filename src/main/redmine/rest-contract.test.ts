import { describe, expect, it } from 'vitest'
import {
  buildRedmineIssuesQuery,
  normalizeRedmineBaseUrl,
  parseRedmineIssues,
  parseRedmineProjects,
  parseRedmineViewer
} from './rest-contract'

describe('buildRedmineIssuesQuery', () => {
  it('defaults to open issues with the page limit', () => {
    const query = new URLSearchParams(buildRedmineIssuesQuery({}))
    expect(query.get('status_id')).toBe('open')
    expect(query.get('limit')).toBe('100')
    expect(query.get('assigned_to_id')).toBeNull()
    expect(query.get('project_id')).toBeNull()
  })

  it('combines the mine, project, and status filters', () => {
    const query = new URLSearchParams(
      buildRedmineIssuesQuery({ mineOnly: true, projectId: 12, statusId: '*', limit: 25 })
    )
    expect(query.get('assigned_to_id')).toBe('me')
    expect(query.get('project_id')).toBe('12')
    expect(query.get('status_id')).toBe('*')
    expect(query.get('limit')).toBe('25')
  })

  it('clamps limits above the Redmine page size', () => {
    expect(new URLSearchParams(buildRedmineIssuesQuery({ limit: 5000 })).get('limit')).toBe('100')
  })
})

describe('parseRedmineIssues', () => {
  it('maps the fields the list renders and derives the issue URL', () => {
    const issues = parseRedmineIssues(
      {
        issues: [
          {
            id: 5969,
            subject: 'Fix login redirect',
            done_ratio: 40,
            updated_on: '2026-08-01T09:00:00Z',
            project: { id: 3, name: 'Worker' },
            status: { id: 2, name: 'In Progress' },
            assigned_to: { id: 9, name: 'Su' }
          }
        ]
      },
      'https://redmine.example.com'
    )
    expect(issues).toEqual([
      {
        id: 5969,
        subject: 'Fix login redirect',
        doneRatio: 40,
        updatedAt: '2026-08-01T09:00:00Z',
        project: { id: 3, name: 'Worker' },
        status: { id: 2, name: 'In Progress' },
        assignedTo: { id: 9, name: 'Su' },
        url: 'https://redmine.example.com/issues/5969'
      }
    ])
  })

  it('tolerates unassigned issues and a missing done ratio', () => {
    const [issue] = parseRedmineIssues(
      { issues: [{ id: 1, subject: 'No owner', assigned_to: null }] },
      'https://redmine.example.com'
    )
    expect(issue.assignedTo).toBeNull()
    expect(issue.doneRatio).toBe(0)
  })

  it('rejects a payload that is not a Redmine issues response', () => {
    expect(() => parseRedmineIssues({ issues: [{ subject: 'no id' }] }, 'https://x')).toThrow()
  })
})

describe('parseRedmineProjects', () => {
  it('sorts projects by name', () => {
    expect(
      parseRedmineProjects({
        projects: [
          { id: 2, name: 'Zeta', identifier: 'zeta' },
          { id: 1, name: 'Alpha', identifier: 'alpha' }
        ]
      }).map((project) => project.name)
    ).toEqual(['Alpha', 'Zeta'])
  })

  it('keeps the parent ref for subprojects', () => {
    expect(
      parseRedmineProjects({
        projects: [{ id: 3, name: 'Sub', identifier: 'sub', parent: { id: 1, name: 'Alpha' } }]
      })[0]
    ).toEqual({ id: 3, name: 'Sub', identifier: 'sub', parent: { id: 1, name: 'Alpha' } })
  })

  it('leaves the parent null for top-level projects', () => {
    expect(
      parseRedmineProjects({ projects: [{ id: 1, name: 'Alpha', identifier: 'alpha' }] })[0].parent
    ).toBeNull()
  })
})

describe('parseRedmineViewer', () => {
  it('joins the first and last name for the display label', () => {
    expect(
      parseRedmineViewer({ user: { id: 4, login: 'su', firstname: 'Su', lastname: 'Yoo' } })
    ).toEqual({ id: 4, login: 'su', displayName: 'Su Yoo', email: null })
  })
})

describe('normalizeRedmineBaseUrl', () => {
  it('strips trailing slashes', () => {
    expect(normalizeRedmineBaseUrl('https://redmine.example.com/')).toBe(
      'https://redmine.example.com'
    )
  })

  it('rejects a non-http scheme', () => {
    expect(() => normalizeRedmineBaseUrl('ftp://redmine.example.com')).toThrow()
  })
})
