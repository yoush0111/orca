import { describe, expect, it } from 'vitest'
import { resolveRedmineRepoId } from './redmine-project-repo-map'
import type { RedmineProject } from './redmine-types'

function project(id: number, parentId?: number): RedmineProject {
  return {
    id,
    name: `p${id}`,
    identifier: `p${id}`,
    ...(parentId ? { parent: { id: parentId, name: `p${parentId}` } } : {})
  }
}

const eligibleRepoIds = ['repo-a', 'repo-b']

describe('resolveRedmineRepoId', () => {
  it('uses a direct mapping', () => {
    expect(
      resolveRedmineRepoId({
        map: { '1': 'repo-a' },
        projectId: 1,
        projects: [project(1)],
        eligibleRepoIds
      })
    ).toBe('repo-a')
  })

  it('inherits the parent mapping', () => {
    expect(
      resolveRedmineRepoId({
        map: { '1': 'repo-a' },
        projectId: 2,
        projects: [project(1), project(2, 1)],
        eligibleRepoIds
      })
    ).toBe('repo-a')
  })

  it('inherits from a grandparent', () => {
    expect(
      resolveRedmineRepoId({
        map: { '1': 'repo-a' },
        projectId: 3,
        projects: [project(1), project(2, 1), project(3, 2)],
        eligibleRepoIds
      })
    ).toBe('repo-a')
  })

  it('prefers the child mapping over the parent', () => {
    expect(
      resolveRedmineRepoId({
        map: { '1': 'repo-a', '2': 'repo-b' },
        projectId: 2,
        projects: [project(1), project(2, 1)],
        eligibleRepoIds
      })
    ).toBe('repo-b')
  })

  it('returns null when nothing in the chain is mapped', () => {
    expect(
      resolveRedmineRepoId({
        map: { '9': 'repo-a' },
        projectId: 2,
        projects: [project(1), project(2, 1)],
        eligibleRepoIds
      })
    ).toBeNull()
  })

  it('returns null when the mapped repo no longer exists', () => {
    expect(
      resolveRedmineRepoId({
        map: { '1': 'repo-gone' },
        projectId: 1,
        projects: [project(1)],
        eligibleRepoIds
      })
    ).toBeNull()
  })

  it('stops on a parent cycle', () => {
    expect(
      resolveRedmineRepoId({
        map: {},
        projectId: 1,
        projects: [project(1, 2), project(2, 1)],
        eligibleRepoIds
      })
    ).toBeNull()
  })

  it('still resolves a direct mapping without the project list', () => {
    expect(
      resolveRedmineRepoId({
        map: { '1': 'repo-a' },
        projectId: 1,
        eligibleRepoIds
      })
    ).toBe('repo-a')
  })
})
